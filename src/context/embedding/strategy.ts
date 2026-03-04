import { z } from 'zod';
import type { ProviderName } from '../../providers';

export const FailureCategorySchema = z.enum([
  'rate_limit',
  'timeout',
  'service_unavailable',
  'auth',
  'invalid_request',
  'unknown',
]);
export type FailureCategory = z.infer<typeof FailureCategorySchema>;

export const EmbeddingStrategyRefSchema = z.object({
  strategyId: z.string().min(1),
  onFailure: z.array(FailureCategorySchema).min(1),
});
export type EmbeddingStrategyRef = z.infer<typeof EmbeddingStrategyRefSchema>;

export const EmbeddingStrategySchema = z.object({
  id: z.string().min(1),
  provider: z.enum(['openai', 'anthropic', 'google']),
  model: z.string().min(1),
  fallback: z.array(EmbeddingStrategyRefSchema).default([]),
});
export type EmbeddingStrategy = z.infer<typeof EmbeddingStrategySchema> & {
  provider: ProviderName;
};

export const EmbeddingStrategyConfigSchema = z.object({
  version: z.literal('1.0'),
  defaults: z.object({
    indexing: z.string().min(1),
    query: z.string().min(1),
  }),
  strategies: z.array(EmbeddingStrategySchema).min(1),
});
export type EmbeddingStrategyConfig = z.infer<typeof EmbeddingStrategyConfigSchema>;

export type EmbeddingStrategyValidationIssue = {
  code:
    | 'unknown_provider'
    | 'missing_model'
    | 'duplicate_strategy'
    | 'unknown_fallback_strategy'
    | 'cyclic_fallback_path'
    | 'unknown_default_strategy'
    | 'schema_invalid';
  strategyId?: string;
  detail: string;
};

export class EmbeddingStrategyConfigError extends Error {
  constructor(public readonly issues: EmbeddingStrategyValidationIssue[]) {
    super(
      `Invalid embedding strategy configuration: ${issues.map((issue) => issue.detail).join('; ')}`
    );
    this.name = 'EmbeddingStrategyConfigError';
  }
}

export class EmbeddingStrategyResolutionError extends Error {
  constructor(
    public readonly strategyId: string,
    public readonly reason: 'unknown_strategy'
  ) {
    super(`Unable to resolve embedding strategy "${strategyId}": ${reason}`);
    this.name = 'EmbeddingStrategyResolutionError';
  }
}

export function parseEmbeddingStrategyConfig(raw: unknown): {
  config?: EmbeddingStrategyConfig;
  issues: EmbeddingStrategyValidationIssue[];
} {
  const parsed = EmbeddingStrategyConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      issues: parsed.error.issues.map((issue) => ({
        code: issue.path.includes('provider')
          ? 'unknown_provider'
          : issue.path.includes('model')
            ? 'missing_model'
            : 'schema_invalid',
        detail: `${issue.path.join('.') || '<root>'}: ${issue.message}`,
      })),
    };
  }

  const config = parsed.data;
  const issues: EmbeddingStrategyValidationIssue[] = [];
  const byId = new Map<string, EmbeddingStrategy>();
  for (const strategy of config.strategies) {
    if (byId.has(strategy.id)) {
      issues.push({
        code: 'duplicate_strategy',
        strategyId: strategy.id,
        detail: `Duplicate strategy id "${strategy.id}"`,
      });
      continue;
    }
    byId.set(strategy.id, strategy);

    if (!strategy.model.trim()) {
      issues.push({
        code: 'missing_model',
        strategyId: strategy.id,
        detail: `Strategy "${strategy.id}" is missing model`,
      });
    }
  }

  for (const strategy of config.strategies) {
    for (const fallback of strategy.fallback) {
      if (!byId.has(fallback.strategyId)) {
        issues.push({
          code: 'unknown_fallback_strategy',
          strategyId: strategy.id,
          detail: `Strategy "${strategy.id}" references unknown fallback strategy "${fallback.strategyId}"`,
        });
      }
    }
  }

  if (!byId.has(config.defaults.indexing)) {
    issues.push({
      code: 'unknown_default_strategy',
      strategyId: config.defaults.indexing,
      detail: `Default indexing strategy "${config.defaults.indexing}" does not exist`,
    });
  }
  if (!byId.has(config.defaults.query)) {
    issues.push({
      code: 'unknown_default_strategy',
      strategyId: config.defaults.query,
      detail: `Default query strategy "${config.defaults.query}" does not exist`,
    });
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function walk(strategyId: string) {
    if (inStack.has(strategyId)) {
      const cycleStart = path.indexOf(strategyId);
      const cycle = [...path.slice(cycleStart), strategyId].join(' -> ');
      issues.push({
        code: 'cyclic_fallback_path',
        strategyId,
        detail: `Cyclic fallback path detected: ${cycle}`,
      });
      return;
    }
    if (visited.has(strategyId)) {
      return;
    }

    visited.add(strategyId);
    inStack.add(strategyId);
    path.push(strategyId);
    const strategy = byId.get(strategyId);
    if (strategy) {
      for (const fallback of strategy.fallback) {
        if (byId.has(fallback.strategyId)) {
          walk(fallback.strategyId);
        }
      }
    }
    path.pop();
    inStack.delete(strategyId);
  }

  for (const strategy of config.strategies) {
    walk(strategy.id);
  }

  return issues.length > 0 ? { issues } : { config, issues: [] };
}

export function resolveEmbeddingStrategy(
  config: EmbeddingStrategyConfig,
  strategyId: string
): EmbeddingStrategy {
  const strategy = config.strategies.find((entry) => entry.id === strategyId);
  if (!strategy) {
    throw new EmbeddingStrategyResolutionError(strategyId, 'unknown_strategy');
  }
  return strategy as EmbeddingStrategy;
}
