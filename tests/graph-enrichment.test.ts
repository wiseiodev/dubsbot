import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, describe, expect, it } from 'vitest';
import { extractGraphDataForFile } from '../src/context/graph/extract';
import { runFullIndex } from '../src/context/indexer/full-index';
import { runHybridRetrieval } from '../src/context/retrieval/hybrid';
import { DubsbotDb } from '../src/db/client';

type Fixture = {
  repoRoot: string;
  db: DubsbotDb;
  cleanup: () => Promise<void>;
};

async function createFixture(files: Record<string, string>): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), 'dubsbot-graph-'));
  const dbRoot = await mkdtemp(join(tmpdir(), 'dubsbot-graph-db-'));
  for (const [path, content] of Object.entries(files)) {
    await writeFile(join(root, path), content, 'utf8');
  }

  const db = new DubsbotDb(new PGlite(join(dbRoot, 'pgdata')));
  const migrations = [
    '0001_init.sql',
    '0002_embedding_provenance.sql',
    '0003_context_graph_enrichment.sql',
  ];
  for (const migration of migrations) {
    const sql = await readFile(join(process.cwd(), 'src/db/migrations', migration), 'utf8');
    await db.exec(sql);
  }

  return {
    repoRoot: root,
    db,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
      await rm(dbRoot, { recursive: true, force: true });
    },
  };
}

describe('context graph enrichment', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanups.map((cleanup) => cleanup()));
    cleanups.length = 0;
  });

  it('keeps symbol extraction counts and canonical IDs stable for fixtures', () => {
    const content = [
      "import { helper } from './dep';",
      'export function alpha() {',
      '  return helper();',
      '}',
      'const beta = () => alpha();',
    ].join('\n');

    const first = extractGraphDataForFile({
      repoRoot: '/repo',
      path: 'src/app.ts',
      content,
    });
    const second = extractGraphDataForFile({
      repoRoot: '/repo',
      path: 'src/app.ts',
      content,
    });

    expect(first.symbols.length).toBeGreaterThan(0);
    expect(first.symbols.map((symbol) => symbol.id)).toEqual(
      second.symbols.map((symbol) => symbol.id)
    );
    expect(first.edges.map((edge) => `${edge.type}:${edge.sourceKey}->${edge.targetKey}`)).toEqual(
      second.edges.map((edge) => `${edge.type}:${edge.sourceKey}->${edge.targetKey}`)
    );
  });

  it('creates required edge types with expected directionality', () => {
    const extraction = extractGraphDataForFile({
      repoRoot: '/repo',
      path: 'src/service.ts',
      content: [
        "import { helper } from './dep';",
        'function run() {',
        '  return helper();',
        '}',
      ].join('\n'),
    });

    const byType = new Map<string, typeof extraction.edges>();
    for (const edge of extraction.edges) {
      byType.set(edge.type, [...(byType.get(edge.type) ?? []), edge]);
    }

    expect(byType.get('defines')?.length ?? 0).toBeGreaterThan(0);
    expect(byType.get('imports')?.length ?? 0).toBeGreaterThan(0);
    expect(byType.get('references')?.length ?? 0).toBeGreaterThan(0);
    expect(byType.get('calls')?.length ?? 0).toBeGreaterThan(0);
    for (const edge of extraction.edges) {
      expect(edge.sourceKey).toContain('::file');
      expect(edge.targetKey).not.toBe(edge.sourceKey);
    }
  });

  it('preserves file-level retrieval behavior while exposing symbol traversals with graph hints', async () => {
    const fixture = await createFixture({
      'a.ts':
        'export function helper() { return 1; }\nexport function caller(){ return helper(); }\n',
      'b.ts': 'export const value = 2;\n',
    });
    cleanups.push(fixture.cleanup);

    await runFullIndex({
      db: fixture.db,
      repoRoot: fixture.repoRoot,
      symbolEnrichmentEnabled: true,
    });

    const symbolCount = await fixture.db.query<{ count: number | string }>(
      "SELECT COUNT(*)::int AS count FROM context_nodes WHERE node_type = 'symbol'"
    );
    expect(Number(symbolCount.rows[0].count)).toBeGreaterThan(0);

    const baseline = await runHybridRetrieval({
      db: fixture.db,
      repoRoot: fixture.repoRoot,
      query: {
        lexicalQuery: 'helper',
        vectorQuery: 'helper function',
        graphHints: [],
        rerank: { method: 'hybrid', topK: 20 },
        maxItems: 5,
      },
    });
    expect(baseline.items.length).toBeGreaterThan(0);
    expect(baseline.citations.every((citation) => citation.sourceType === 'chunk')).toBe(true);

    const enriched = await runHybridRetrieval({
      db: fixture.db,
      repoRoot: fixture.repoRoot,
      query: {
        lexicalQuery: 'helper',
        vectorQuery: 'helper function',
        graphHints: ['helper'],
        rerank: { method: 'hybrid', topK: 20 },
        maxItems: 5,
      },
    });
    expect(enriched.items.length).toBeGreaterThan(0);
    expect(enriched.citations.some((citation) => citation.sourceType === 'graph_node')).toBe(true);
  });

  it('meets enrichment volume and runtime acceptance thresholds', async () => {
    const lines = Array.from(
      { length: 120 },
      (_, index) => `export function fn${index}() { return ${index}; }`
    );
    const fixture = await createFixture({
      'volume.ts': `${lines.join('\n')}\n`,
    });
    cleanups.push(fixture.cleanup);

    const started = performance.now();
    await runFullIndex({
      db: fixture.db,
      repoRoot: fixture.repoRoot,
      symbolEnrichmentEnabled: true,
    });
    const durationMs = performance.now() - started;

    const symbols = await fixture.db.query<{ count: number | string }>(
      "SELECT COUNT(*)::int AS count FROM context_nodes WHERE node_type = 'symbol'"
    );
    const edges = await fixture.db.query<{ count: number | string }>(
      'SELECT COUNT(*)::int AS count FROM context_edges'
    );
    const symbolCount = Number(symbols.rows[0].count);
    const edgeCount = Number(edges.rows[0].count);

    expect(durationMs).toBeLessThan(10_000);
    expect(symbolCount).toBeLessThanOrEqual(lines.length * 2);
    expect(edgeCount).toBeLessThanOrEqual(symbolCount * 6);
  });
});
