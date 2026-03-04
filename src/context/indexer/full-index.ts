import fg from 'fast-glob';
import type { DubsbotDb } from '../../db/client';
import type { ProviderAdapter } from '../../providers/types';
import { createFileIndexHelpers } from './file-index';

export async function runFullIndex(input: {
  db: DubsbotDb;
  repoRoot: string;
  embedProvider?: ProviderAdapter;
  embeddingModel?: string;
  embeddingStrategyId?: string;
  symbolEnrichmentEnabled?: boolean;
}): Promise<{ filesIndexed: number; chunksIndexed: number }> {
  const paths = await fg(['**/*', '!node_modules/**', '!.git/**', '!dist/**', '!coverage/**'], {
    cwd: input.repoRoot,
    dot: false,
    onlyFiles: true,
    absolute: false,
  });

  let filesIndexed = 0;
  let chunksIndexed = 0;
  const helpers = createFileIndexHelpers(input);

  for (const relativePath of paths) {
    const indexed = await helpers.upsertIndexedFileByPath(relativePath);
    if (indexed.status !== 'indexed') {
      continue;
    }

    filesIndexed += 1;
    chunksIndexed += indexed.chunksInserted;
  }

  return { filesIndexed, chunksIndexed };
}
