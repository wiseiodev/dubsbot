import { detectProvider, type ProviderName } from '../../providers';
import {
  type EmbeddingStrategyConfig,
  EmbeddingStrategyConfigError,
  parseEmbeddingStrategyConfig,
} from './strategy';

export function loadEmbeddingStrategyConfig(): EmbeddingStrategyConfig {
  const rawFromEnv = process.env.DUBSBOT_EMBEDDING_STRATEGY_CONFIG_JSON;
  const raw = rawFromEnv ? JSON.parse(rawFromEnv) : buildLegacyDefaultConfig();
  const parsed = parseEmbeddingStrategyConfig(raw);
  if (!parsed.config) {
    throw new EmbeddingStrategyConfigError(parsed.issues);
  }
  return parsed.config;
}

export function isEmbeddingStrategyV2Enabled(): boolean {
  return process.env.DUBSBOT_EMBEDDING_STRATEGY_V2 === '1';
}

function buildLegacyDefaultConfig(): EmbeddingStrategyConfig {
  const primaryProvider = detectProvider();
  const primary = toPrimaryStrategy(primaryProvider, 'default-primary');
  const strategies = [primary];

  if (primaryProvider === 'anthropic') {
    strategies.push(toPrimaryStrategy('openai', 'fallback-openai'));
    strategies.push(toPrimaryStrategy('google', 'fallback-google'));
    primary.fallback = [
      {
        strategyId: 'fallback-openai',
        onFailure: ['rate_limit', 'timeout', 'service_unavailable'],
      },
      {
        strategyId: 'fallback-google',
        onFailure: ['rate_limit', 'timeout', 'service_unavailable'],
      },
    ];
  }

  return {
    version: '1.0',
    defaults: {
      indexing: 'default-primary',
      query: 'default-primary',
    },
    strategies,
  };
}

function toPrimaryStrategy(provider: ProviderName, id: string) {
  return {
    id,
    provider,
    model: defaultEmbeddingModel(provider),
    fallback: [] as Array<{
      strategyId: string;
      onFailure: Array<
        'rate_limit' | 'timeout' | 'service_unavailable' | 'auth' | 'invalid_request' | 'unknown'
      >;
    }>,
  };
}

function defaultEmbeddingModel(provider: ProviderName): string {
  switch (provider) {
    case 'openai':
      return process.env.DUBSBOT_OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
    case 'google':
      return process.env.DUBSBOT_GOOGLE_EMBEDDING_MODEL ?? 'text-embedding-004';
    case 'anthropic':
      return process.env.DUBSBOT_ANTHROPIC_EMBEDDING_MODEL ?? 'deterministic-v1';
    default:
      return 'deterministic-v1';
  }
}
