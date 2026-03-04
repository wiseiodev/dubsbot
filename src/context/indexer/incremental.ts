import { execFile } from 'node:child_process';
import { isAbsolute, posix, relative, sep } from 'node:path';
import { promisify } from 'node:util';
import type { DubsbotDb } from '../../db/client';
import type { ProviderAdapter } from '../../providers/types';
import { createFileIndexHelpers } from './file-index';
import { runFullIndex } from './full-index';

const execFileAsync = promisify(execFile);

export type IncrementalPathOperation = {
  path: string;
  type: 'upsert' | 'delete';
};

export type IncrementalTrigger =
  | {
      source: 'fs';
      event: 'add' | 'change' | 'unlink';
    }
  | {
      source: 'git-head';
      previous: string;
      current: string;
    };

export type IncrementalIndexResult = {
  mode: 'incremental' | 'full-fallback';
  fallbackReason: string | null;
  filesIndexed: number;
  chunksIndexed: number;
  filesInserted: number;
  filesUpdated: number;
  filesDeleted: number;
  chunksInserted: number;
  chunksDeleted: number;
};

export async function runIncrementalIndex(input: {
  db: DubsbotDb;
  repoRoot: string;
  operations?: IncrementalPathOperation[];
  changedPaths?: string[];
  trigger?: IncrementalTrigger;
  embedProvider?: ProviderAdapter;
  embeddingModel?: string;
  symbolEnrichmentEnabled?: boolean;
}): Promise<IncrementalIndexResult> {
  const fileIndexHelpers = createFileIndexHelpers(input);

  let operations =
    input.operations ??
    (input.changedPaths ?? []).map((path) => ({
      path,
      type: 'upsert' as const,
    }));
  let fallbackReason: string | null = null;

  if (operations.length === 0 && input.trigger?.source === 'git-head') {
    const resolved = await resolveGitHeadOperations(
      input.repoRoot,
      input.trigger.previous,
      input.trigger.current
    );
    if (resolved) {
      operations = resolved;
    } else {
      fallbackReason = `unresolved-git-head-transition:${input.trigger.previous.slice(0, 8)}->${input.trigger.current.slice(0, 8)}`;
    }
  }

  if (fallbackReason) {
    const full = await runFullIndex({
      db: input.db,
      repoRoot: input.repoRoot,
      embedProvider: input.embedProvider,
      embeddingModel: input.embeddingModel,
    });
    console.warn(`[indexer:incremental] falling back to full index (${fallbackReason})`);
    return {
      mode: 'full-fallback',
      fallbackReason,
      filesIndexed: full.filesIndexed,
      chunksIndexed: full.chunksIndexed,
      filesInserted: 0,
      filesUpdated: full.filesIndexed,
      filesDeleted: 0,
      chunksInserted: full.chunksIndexed,
      chunksDeleted: 0,
    };
  }

  const counters: IncrementalIndexResult = {
    mode: 'incremental',
    fallbackReason: null,
    filesIndexed: 0,
    chunksIndexed: 0,
    filesInserted: 0,
    filesUpdated: 0,
    filesDeleted: 0,
    chunksInserted: 0,
    chunksDeleted: 0,
  };

  for (const operation of coalesceOperations(input.repoRoot, operations)) {
    if (operation.type === 'delete') {
      const deleted = await fileIndexHelpers.deleteIndexedFileByPath(operation.path);
      counters.filesDeleted += deleted.fileDeleted ? 1 : 0;
      counters.chunksDeleted += deleted.chunksDeleted;
      continue;
    }

    const upserted = await fileIndexHelpers.upsertIndexedFileByPath(operation.path);
    if (upserted.status === 'missing') {
      const deleted = await fileIndexHelpers.deleteIndexedFileByPath(operation.path);
      counters.filesDeleted += deleted.fileDeleted ? 1 : 0;
      counters.chunksDeleted += deleted.chunksDeleted;
      continue;
    }

    counters.filesIndexed += 1;
    counters.chunksIndexed += upserted.chunksInserted;
    counters.chunksInserted += upserted.chunksInserted;
    counters.chunksDeleted += upserted.chunksDeleted;
    if (upserted.fileStatus === 'inserted') {
      counters.filesInserted += 1;
    } else {
      counters.filesUpdated += 1;
    }
  }

  return counters;
}

async function resolveGitHeadOperations(
  repoRoot: string,
  previous: string,
  current: string
): Promise<IncrementalPathOperation[] | null> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['diff', '--name-status', '--no-renames', previous, current],
      { cwd: repoRoot }
    );
    const lines = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const operations: IncrementalPathOperation[] = [];
    for (const line of lines) {
      const [status, ...rawPathParts] = line.split(/\s+/);
      const rawPath = rawPathParts.join(' ').trim();
      if (!rawPath) {
        continue;
      }
      operations.push({
        path: rawPath,
        type: status.startsWith('D') ? 'delete' : 'upsert',
      });
    }
    return operations;
  } catch {
    return null;
  }
}

function coalesceOperations(
  repoRoot: string,
  operations: IncrementalPathOperation[]
): IncrementalPathOperation[] {
  const byPath = new Map<string, IncrementalPathOperation>();
  for (const operation of operations) {
    const normalizedPath = normalizeRepoRelativePath(repoRoot, operation.path);
    if (!normalizedPath) {
      continue;
    }
    byPath.set(normalizedPath, {
      path: normalizedPath,
      type: operation.type,
    });
  }
  return [...byPath.values()];
}

function normalizeRepoRelativePath(repoRoot: string, candidatePath: string): string | null {
  const repoRelative = isAbsolute(candidatePath)
    ? relative(repoRoot, candidatePath)
    : candidatePath;
  const normalized = posix.normalize(repoRelative.split(sep).join('/')).replace(/^\.\/+/, '');
  if (normalized === '' || normalized === '.' || normalized.startsWith('../')) {
    return null;
  }
  return normalized;
}
