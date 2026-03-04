import type { ProviderAdapter } from '../../providers/types';
import {
  type EmbeddingStrategyConfig,
  type FailureCategory,
  resolveEmbeddingStrategy,
} from './strategy';

export type EmbeddingAttempt = {
  strategyId: string;
  provider: string;
  model: string;
  status: 'success' | 'failure';
  failureCategory?: FailureCategory;
};

export type EmbeddingProvenance = {
  strategyId: string;
  attemptPath: EmbeddingAttempt[];
  resolvedBy?: { strategyId: string; provider: string; model: string };
  fallbackUsed: boolean;
  failureCategory?: FailureCategory;
  terminalReason?: 'fallback_disallowed' | 'fallback_exhausted' | 'no_fallback';
};

export type EmbeddingExecutionSuccess = {
  ok: true;
  embedding: number[];
  provider: string;
  model: string;
  provenance: EmbeddingProvenance;
};

export type EmbeddingExecutionFailure = {
  ok: false;
  message: string;
  provenance: EmbeddingProvenance;
};

export type EmbeddingExecutionResult = EmbeddingExecutionSuccess | EmbeddingExecutionFailure;

export class EmbeddingExecutionError extends Error {
  constructor(
    message: string,
    public readonly provenance: EmbeddingProvenance
  ) {
    super(message);
    this.name = 'EmbeddingExecutionError';
  }
}

export async function executeEmbeddingWithStrategy(input: {
  config: EmbeddingStrategyConfig;
  strategyId: string;
  value: string;
  adapterForProvider: (provider: string) => ProviderAdapter;
}): Promise<EmbeddingExecutionResult> {
  const attemptPath: EmbeddingAttempt[] = [];
  const queue: string[] = [input.strategyId];
  const visited = new Set<string>();
  let fallbackUsed = false;

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    const strategy = resolveEmbeddingStrategy(input.config, currentId);
    const adapter = input.adapterForProvider(strategy.provider);

    try {
      const vectors = await adapter.embed({
        model: strategy.model,
        values: [input.value],
      });
      const vector = vectors[0] ?? [];
      attemptPath.push({
        strategyId: currentId,
        provider: strategy.provider,
        model: strategy.model,
        status: 'success',
      });
      return {
        ok: true,
        embedding: vector,
        provider: strategy.provider,
        model: strategy.model,
        provenance: {
          strategyId: input.strategyId,
          attemptPath,
          fallbackUsed,
          resolvedBy: {
            strategyId: currentId,
            provider: strategy.provider,
            model: strategy.model,
          },
        },
      };
    } catch (error) {
      const failureCategory = classifyEmbeddingFailure(error);
      attemptPath.push({
        strategyId: currentId,
        provider: strategy.provider,
        model: strategy.model,
        status: 'failure',
        failureCategory,
      });

      const eligibleFallbacks = strategy.fallback.filter((entry) =>
        entry.onFailure.includes(failureCategory)
      );
      if (eligibleFallbacks.length === 0) {
        return {
          ok: false,
          message: `Embedding failed for strategy "${currentId}" with category "${failureCategory}" and no eligible fallback.`,
          provenance: {
            strategyId: input.strategyId,
            attemptPath,
            fallbackUsed,
            failureCategory,
            terminalReason: strategy.fallback.length > 0 ? 'fallback_disallowed' : 'no_fallback',
          },
        };
      }

      const fallbackIds = eligibleFallbacks
        .map((entry) => entry.strategyId)
        .filter((strategyId) => !visited.has(strategyId) && !queue.includes(strategyId));

      if (fallbackIds.length === 0) {
        return {
          ok: false,
          message: `Embedding failed for strategy "${currentId}" with category "${failureCategory}" and exhausted fallback chain.`,
          provenance: {
            strategyId: input.strategyId,
            attemptPath,
            fallbackUsed: true,
            failureCategory,
            terminalReason: 'fallback_exhausted',
          },
        };
      }

      fallbackUsed = true;
      for (const fallbackId of fallbackIds) {
        queue.push(fallbackId);
      }
    }
  }

  return {
    ok: false,
    message: `Embedding failed for strategy "${input.strategyId}" after exhausting fallback chain.`,
    provenance: {
      strategyId: input.strategyId,
      attemptPath,
      fallbackUsed,
      failureCategory: attemptPath.at(-1)?.failureCategory,
      terminalReason: 'fallback_exhausted',
    },
  };
}

export function classifyEmbeddingFailure(error: unknown): FailureCategory {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes('rate limit') || message.includes('429')) {
    return 'rate_limit';
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'timeout';
  }
  if (message.includes('503') || message.includes('unavailable')) {
    return 'service_unavailable';
  }
  if (message.includes('401') || message.includes('403') || message.includes('auth')) {
    return 'auth';
  }
  if (message.includes('400') || message.includes('invalid')) {
    return 'invalid_request';
  }
  return 'unknown';
}

export function assertEmbeddingSuccess(
  result: EmbeddingExecutionResult
): EmbeddingExecutionSuccess {
  if (result.ok) {
    return result;
  }
  throw new EmbeddingExecutionError(result.message, result.provenance);
}
