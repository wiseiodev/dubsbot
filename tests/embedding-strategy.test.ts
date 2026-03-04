import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadEmbeddingStrategyConfig } from '../src/context/embedding/config';
import { executeEmbeddingWithStrategy } from '../src/context/embedding/engine';
import {
  EmbeddingStrategyConfigError,
  EmbeddingStrategyResolutionError,
  parseEmbeddingStrategyConfig,
  resolveEmbeddingStrategy,
} from '../src/context/embedding/strategy';
import type { ProviderAdapter } from '../src/providers/types';

class FakeProvider implements ProviderAdapter {
  constructor(
    private readonly behavior: 'ok' | 'rate_limit' | 'auth' | 'timeout' | 'service_unavailable'
  ) {}

  async generateStructured(): Promise<never> {
    throw new Error('not used');
  }

  async *streamStructured(): AsyncIterable<never> {}

  async embed(): Promise<number[][]> {
    if (this.behavior === 'ok') {
      return [[0.1, 0.2, 0.3]];
    }
    if (this.behavior === 'rate_limit') {
      throw new Error('429 rate limit');
    }
    if (this.behavior === 'auth') {
      throw new Error('401 auth');
    }
    if (this.behavior === 'timeout') {
      throw new Error('timeout');
    }
    throw new Error('503 unavailable');
  }

  async countTokens(): Promise<number> {
    return 1;
  }

  supports(): boolean {
    return true;
  }
}

const baseConfig = {
  version: '1.0',
  defaults: { indexing: 'indexing', query: 'query' },
  strategies: [
    {
      id: 'indexing',
      provider: 'anthropic',
      model: 'claude-embed',
      fallback: [{ strategyId: 'fallback-openai', onFailure: ['rate_limit', 'timeout'] }],
    },
    {
      id: 'query',
      provider: 'anthropic',
      model: 'claude-embed',
      fallback: [{ strategyId: 'fallback-openai', onFailure: ['rate_limit'] }],
    },
    {
      id: 'fallback-openai',
      provider: 'openai',
      model: 'text-embedding-3-small',
      fallback: [],
    },
  ],
} as const;

function requireConfig(raw: unknown) {
  const parsed = parseEmbeddingStrategyConfig(raw);
  if (!parsed.config) {
    throw new Error(
      `Expected valid config, received issues: ${parsed.issues.map((i) => i.detail).join('; ')}`
    );
  }
  return parsed.config;
}

describe('embedding strategy configuration', () => {
  beforeEach(() => {
    delete process.env.DUBSBOT_EMBEDDING_STRATEGY_CONFIG_JSON;
  });

  it('loads valid strategy config and resolves known strategy ids', () => {
    const config = requireConfig(baseConfig);
    expect(resolveEmbeddingStrategy(config, 'indexing').provider).toBe('anthropic');
  });

  it('rejects invalid config entries (unknown provider, missing fallback strategy, cycles)', () => {
    const parsed = parseEmbeddingStrategyConfig({
      version: '1.0',
      defaults: { indexing: 'a', query: 'b' },
      strategies: [
        {
          id: 'a',
          provider: 'openai',
          model: 'x',
          fallback: [{ strategyId: 'b', onFailure: ['rate_limit'] }],
        },
        {
          id: 'b',
          provider: 'google',
          model: 'x',
          fallback: [{ strategyId: 'a', onFailure: ['rate_limit'] }],
        },
        {
          id: 'bad',
          provider: 'openai',
          model: 'x',
          fallback: [{ strategyId: 'missing', onFailure: ['rate_limit'] }],
        },
      ],
    });

    expect(parsed.config).toBeUndefined();
    expect(parsed.issues.some((issue) => issue.code === 'cyclic_fallback_path')).toBe(true);
    expect(parsed.issues.some((issue) => issue.code === 'unknown_fallback_strategy')).toBe(true);
  });

  it('throws structured config error at startup when env config is invalid', () => {
    process.env.DUBSBOT_EMBEDDING_STRATEGY_CONFIG_JSON = JSON.stringify({
      version: '1.0',
      defaults: { indexing: 'missing', query: 'missing' },
      strategies: [{ id: 'only', provider: 'openai', model: 'x', fallback: [] }],
    });

    expect(() => loadEmbeddingStrategyConfig()).toThrow(EmbeddingStrategyConfigError);
  });

  it('throws structured runtime error when strategy id is unknown', () => {
    const config = requireConfig(baseConfig);
    expect(() => resolveEmbeddingStrategy(config, 'not-found')).toThrow(
      EmbeddingStrategyResolutionError
    );
  });
});

describe('anthropic native-first fallback policy', () => {
  it('returns anthropic result directly on success', async () => {
    const config = requireConfig(baseConfig);
    const result = await executeEmbeddingWithStrategy({
      config,
      strategyId: 'indexing',
      value: 'hello',
      adapterForProvider: (provider) =>
        provider === 'anthropic' ? new FakeProvider('ok') : new FakeProvider('ok'),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provenance.fallbackUsed).toBe(false);
      expect(result.provenance.attemptPath).toHaveLength(1);
      expect(result.provenance.resolvedBy?.provider).toBe('anthropic');
    }
  });

  it('does not fallback on non-fallbackable anthropic failure', async () => {
    const config = requireConfig(baseConfig);
    const adapterSpy = vi.fn((provider: string) =>
      provider === 'anthropic' ? new FakeProvider('auth') : new FakeProvider('ok')
    );

    const result = await executeEmbeddingWithStrategy({
      config,
      strategyId: 'indexing',
      value: 'hello',
      adapterForProvider: adapterSpy,
    });

    expect(result.ok).toBe(false);
    expect(adapterSpy).toHaveBeenCalledTimes(1);
    if (!result.ok) {
      expect(result.provenance.failureCategory).toBe('auth');
      expect(result.provenance.terminalReason).toBe('fallback_disallowed');
    }
  });

  it('falls back in configured order for fallbackable errors', async () => {
    const config = requireConfig(baseConfig);
    const result = await executeEmbeddingWithStrategy({
      config,
      strategyId: 'indexing',
      value: 'hello',
      adapterForProvider: (provider) =>
        provider === 'anthropic' ? new FakeProvider('rate_limit') : new FakeProvider('ok'),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provenance.fallbackUsed).toBe(true);
      expect(result.provenance.attemptPath.map((entry) => entry.provider)).toEqual([
        'anthropic',
        'openai',
      ]);
    }
  });

  it('returns terminal failure when no fallback is configured', async () => {
    const config = requireConfig({
      version: '1.0',
      defaults: { indexing: 'solo', query: 'solo' },
      strategies: [{ id: 'solo', provider: 'anthropic', model: 'claude-embed', fallback: [] }],
    });
    const result = await executeEmbeddingWithStrategy({
      config,
      strategyId: 'solo',
      value: 'hello',
      adapterForProvider: () => new FakeProvider('rate_limit'),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.provenance.terminalReason).toBe('no_fallback');
      expect(result.provenance.attemptPath).toHaveLength(1);
    }
  });
});

describe('embedding provenance completeness', () => {
  it('includes complete provenance fields on success', async () => {
    const config = requireConfig(baseConfig);
    const result = await executeEmbeddingWithStrategy({
      config,
      strategyId: 'indexing',
      value: 'hello',
      adapterForProvider: (provider) =>
        provider === 'anthropic' ? new FakeProvider('rate_limit') : new FakeProvider('ok'),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provenance.strategyId).toBe('indexing');
      expect(result.provenance.resolvedBy).toBeDefined();
      expect(result.provenance.attemptPath.length).toBeGreaterThan(0);
    }
  });

  it('includes complete provenance fields on terminal failure', async () => {
    const config = requireConfig(baseConfig);
    const result = await executeEmbeddingWithStrategy({
      config,
      strategyId: 'indexing',
      value: 'hello',
      adapterForProvider: () => new FakeProvider('timeout'),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.provenance.strategyId).toBe('indexing');
      expect(result.provenance.attemptPath.length).toBeGreaterThan(0);
      expect(result.provenance.failureCategory).toBeDefined();
      expect(result.provenance.terminalReason).toBeDefined();
    }
  });
});
