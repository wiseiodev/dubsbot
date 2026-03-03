import type { DubsbotDb } from '../../db/client';
import type { ProviderAdapter } from '../../providers/types';
import { runFullIndex } from './full-index';

export async function runIncrementalIndex(input: {
  db: DubsbotDb;
  repoRoot: string;
  changedPaths: string[];
  embedProvider?: ProviderAdapter;
  embeddingModel?: string;
}): Promise<{ filesIndexed: number; chunksIndexed: number }> {
  if (input.changedPaths.length === 0) {
    return { filesIndexed: 0, chunksIndexed: 0 };
  }

  return runFullIndex({
    db: input.db,
    repoRoot: input.repoRoot,
    embedProvider: input.embedProvider,
    embeddingModel: input.embeddingModel,
  });
}
