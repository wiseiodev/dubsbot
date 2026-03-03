import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { DubsbotDb } from '../../db/client';
import { type ContextBundle, ContextBundleSchema, type ContextQuery } from '../schemas';
import { cosineSimilarity, deterministicEmbedding, hybridRerank } from './rerank';

type ChunkRow = {
  id: string;
  content: string;
  path: string;
  embedding: string | null;
};

async function grepSearch(
  cwd: string,
  query: string
): Promise<Array<{ path: string; line: string; score: number }>> {
  if (!query.trim()) {
    return [];
  }

  return new Promise((resolve) => {
    const child = spawn('rg', ['--line-number', '--no-heading', query, '.'], {
      cwd,
      shell: false,
    });

    let stdout = '';
    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString('utf8');
    });

    child.on('close', () => {
      const results = stdout
        .split('\n')
        .filter(Boolean)
        .slice(0, 50)
        .map((line) => {
          const [path, lineNumber, ...rest] = line.split(':');
          return {
            path,
            line: `${lineNumber}:${rest.join(':')}`,
            score: 0.7,
          };
        });
      resolve(results);
    });

    child.on('error', () => resolve([]));
  });
}

export async function runHybridRetrieval(input: {
  db: DubsbotDb;
  repoRoot: string;
  query: ContextQuery;
  sessionId?: string;
}): Promise<ContextBundle> {
  const query = input.query;
  const lexical = await grepSearch(input.repoRoot, query.lexicalQuery || query.vectorQuery);
  const queryVector = deterministicEmbedding(query.vectorQuery || query.lexicalQuery);

  const rows = await input.db.query<ChunkRow>(
    `SELECT c.id, c.content, f.path, ce.embedding::text as embedding
     FROM chunks c
     JOIN files f ON f.id = c.file_id
     LEFT JOIN chunk_embeddings ce ON ce.chunk_id = c.id
     WHERE f.repo_root = $1
     LIMIT 500`,
    [input.repoRoot]
  );

  const ranked = hybridRerank(
    rows.rows.map((row) => {
      const embedding = row.embedding
        ? (JSON.parse(row.embedding) as number[])
        : deterministicEmbedding(row.content);
      const vectorScore = cosineSimilarity(queryVector, embedding);
      const lexicalHit = lexical.find((hit) => hit.path === row.path);
      return {
        item: row,
        lexicalScore: lexicalHit ? lexicalHit.score : 0,
        vectorScore,
        graphScore: 0.25,
      };
    })
  ).slice(0, query.maxItems);

  const retrievalId = randomUUID();
  await input.db.query(
    'INSERT INTO retrieval_runs (id, session_id, query, strategy, metadata) VALUES ($1, $2, $3, $4, $5::jsonb)',
    [
      retrievalId,
      input.sessionId ?? null,
      query.lexicalQuery || query.vectorQuery,
      'hybrid',
      JSON.stringify(query),
    ]
  );

  const items = ranked.map((entry, index) => ({
    id: entry.item.id,
    content: entry.item.content,
    score: entry.totalScore,
    metadata: {
      path: entry.item.path,
      lexicalScore: entry.lexicalScore,
      vectorScore: entry.vectorScore,
      rank: index + 1,
    },
  }));

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    await input.db.query(
      'INSERT INTO context_bundle_items (id, retrieval_run_id, source_type, source_id, score, rank_index, payload) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)',
      [
        randomUUID(),
        retrievalId,
        'chunk',
        item.id,
        item.score,
        i + 1,
        JSON.stringify(item.metadata),
      ]
    );
  }

  const bundle = ContextBundleSchema.parse({
    query,
    items,
    citations: items.map((item) => ({
      sourceType: 'chunk',
      sourceId: item.id,
      path: String(item.metadata.path),
      score: item.score,
    })),
  });

  return bundle;
}
