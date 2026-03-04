import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, describe, expect, it } from 'vitest';
import { runFullIndex } from '../src/context/indexer/full-index';
import { runIncrementalIndex } from '../src/context/indexer/incremental';
import { DubsbotDb } from '../src/db/client';

type Fixture = {
  repoRoot: string;
  db: DubsbotDb;
  cleanup: () => Promise<void>;
};

async function createFixture(files: Record<string, string>): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), 'dubsbot-incremental-'));
  const dbRoot = await mkdtemp(join(tmpdir(), 'dubsbot-incremental-db-'));
  for (const [path, content] of Object.entries(files)) {
    await writeFile(join(root, path), content, 'utf8');
  }

  const db = new DubsbotDb(new PGlite(join(dbRoot, 'pgdata')));
  const migration0001 = await readFile(
    join(process.cwd(), 'src/db/migrations/0001_init.sql'),
    'utf8'
  );
  const migration0002 = await readFile(
    join(process.cwd(), 'src/db/migrations/0002_embedding_provenance.sql'),
    'utf8'
  );
  await db.exec(migration0001);
  await db.exec(migration0002);

  return {
    repoRoot: root,
    db,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
      await rm(dbRoot, { recursive: true, force: true });
    },
  };
}

async function getChunkIdsForPath(
  db: DubsbotDb,
  repoRoot: string,
  path: string
): Promise<string[]> {
  const rows = await db.query<{ id: string }>(
    `SELECT c.id
     FROM chunks c
     JOIN files f ON f.id = c.file_id
     WHERE f.repo_root = $1 AND f.path = $2
     ORDER BY c.chunk_index ASC`,
    [repoRoot, path]
  );
  return rows.rows.map((row) => row.id);
}

describe('incremental indexing', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanups.map((cleanup) => cleanup()));
    cleanups.length = 0;
  });

  it('updates only targeted changed paths and coalesces duplicates', async () => {
    const fixture = await createFixture({
      'a.ts': 'export const a = 1;\n',
      'b.ts': 'export const b = 1;\n',
    });
    cleanups.push(fixture.cleanup);

    await runFullIndex({ db: fixture.db, repoRoot: fixture.repoRoot });
    const beforeUnchangedChunkIds = await getChunkIdsForPath(fixture.db, fixture.repoRoot, 'b.ts');

    await writeFile(join(fixture.repoRoot, 'a.ts'), 'export const a = 2;\n', 'utf8');
    const result = await runIncrementalIndex({
      db: fixture.db,
      repoRoot: fixture.repoRoot,
      operations: [
        { path: 'a.ts', type: 'upsert' },
        { path: 'a.ts', type: 'upsert' },
      ],
      trigger: { source: 'fs', event: 'change' },
    });

    const afterUnchangedChunkIds = await getChunkIdsForPath(fixture.db, fixture.repoRoot, 'b.ts');
    expect(afterUnchangedChunkIds).toEqual(beforeUnchangedChunkIds);
    expect(result).toMatchObject({
      mode: 'incremental',
      filesIndexed: 1,
      filesInserted: 0,
      filesUpdated: 1,
      filesDeleted: 0,
    });
  });

  it('removes stale files/chunks/embeddings/documents on delete operations', async () => {
    const fixture = await createFixture({
      'delete-me.ts': 'export const toDelete = true;\n',
    });
    cleanups.push(fixture.cleanup);

    await runFullIndex({ db: fixture.db, repoRoot: fixture.repoRoot });
    const initialChunkIds = await getChunkIdsForPath(fixture.db, fixture.repoRoot, 'delete-me.ts');
    expect(initialChunkIds.length).toBeGreaterThan(0);

    await rm(join(fixture.repoRoot, 'delete-me.ts'));
    const result = await runIncrementalIndex({
      db: fixture.db,
      repoRoot: fixture.repoRoot,
      operations: [{ path: 'delete-me.ts', type: 'delete' }],
      trigger: { source: 'fs', event: 'unlink' },
    });

    const filesCount = await fixture.db.query<{ count: number | string }>(
      'SELECT COUNT(*)::int AS count FROM files WHERE repo_root = $1 AND path = $2',
      [fixture.repoRoot, 'delete-me.ts']
    );
    expect(Number(filesCount.rows[0].count)).toBe(0);

    for (const chunkId of initialChunkIds) {
      const embeddingCount = await fixture.db.query<{ count: number | string }>(
        'SELECT COUNT(*)::int AS count FROM chunk_embeddings WHERE chunk_id = $1',
        [chunkId]
      );
      const documentCount = await fixture.db.query<{ count: number | string }>(
        'SELECT COUNT(*)::int AS count FROM bm25_documents WHERE chunk_id = $1',
        [chunkId]
      );
      expect(Number(embeddingCount.rows[0].count)).toBe(0);
      expect(Number(documentCount.rows[0].count)).toBe(0);
    }

    expect(result).toMatchObject({
      mode: 'incremental',
      filesDeleted: 1,
    });
    expect(result.chunksDeleted).toBeGreaterThan(0);
  });

  it('falls back only for unresolved git-head transitions', async () => {
    const fixture = await createFixture({
      'one.ts': 'export const one = 1;\n',
      'two.ts': 'export const two = 2;\n',
    });
    cleanups.push(fixture.cleanup);

    const result = await runIncrementalIndex({
      db: fixture.db,
      repoRoot: fixture.repoRoot,
      trigger: { source: 'git-head', previous: 'deadbeef', current: 'cafebabe' },
    });

    expect(result.mode).toBe('full-fallback');
    expect(result.fallbackReason).toContain('unresolved-git-head-transition');
    expect(result.filesIndexed).toBe(2);
  });
});
