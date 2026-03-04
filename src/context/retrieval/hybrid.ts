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
  provider: string | null;
  model: string | null;
  provenance: string | null;
};

type GraphTraversalHit = {
  nodeId: string;
  nodeKey: string;
  nodeType: string;
  edgeType: string | null;
  connectedNodeId: string | null;
  connectedNodeKey: string | null;
  connectedNodeType: string | null;
  path: string | null;
  connectedPath: string | null;
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
  const graphTraversal = await traverseGraphHints({
    db: input.db,
    repoRoot: input.repoRoot,
    hints: query.graphHints,
  });
  const boostedPaths = new Set(graphTraversal.pathHints);

  const rows = await input.db.query<ChunkRow>(
    `SELECT c.id, c.content, f.path, ce.embedding::text as embedding, ce.provider, ce.model, ce.provenance::text as provenance
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
      const graphScore = boostedPaths.has(row.path) ? 0.6 : 0.25;
      return {
        item: row,
        lexicalScore: lexicalHit ? lexicalHit.score : 0,
        vectorScore,
        graphScore,
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
      provider: entry.item.provider ?? 'unknown',
      model: entry.item.model ?? 'unknown',
      embeddingProvenance: safeJsonParse(entry.item.provenance),
      lexicalScore: entry.lexicalScore,
      vectorScore: entry.vectorScore,
      graphScore: entry.graphScore,
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
    citations: [
      ...items.map((item) => ({
        sourceType: 'chunk',
        sourceId: item.id,
        path: String(item.metadata.path),
        score: item.score,
      })),
      ...graphTraversal.citations,
    ],
  });

  return bundle;
}

async function traverseGraphHints(input: {
  db: DubsbotDb;
  repoRoot: string;
  hints: string[];
}): Promise<{
  pathHints: string[];
  citations: Array<{ sourceType: 'graph_node'; sourceId: string; path?: string; score: number }>;
}> {
  if (input.hints.length === 0) {
    return { pathHints: [], citations: [] };
  }

  const rows = await input.db.query<GraphTraversalHit>(
    `SELECT
       n.id AS "nodeId",
       n.node_key AS "nodeKey",
       n.node_type AS "nodeType",
       e.edge_type AS "edgeType",
       n2.id AS "connectedNodeId",
       n2.node_key AS "connectedNodeKey",
       n2.node_type AS "connectedNodeType",
       n.payload->>'path' AS "path",
       n2.payload->>'path' AS "connectedPath"
     FROM context_nodes n
     LEFT JOIN context_edges e ON e.source_node_id = n.id
     LEFT JOIN context_nodes n2 ON n2.id = e.target_node_id
     WHERE n.payload->>'repoRoot' = $1
       AND (
         n.node_key = ANY($2::text[])
         OR n.payload->>'name' = ANY($2::text[])
         OR n.payload->>'path' = ANY($2::text[])
       )
     LIMIT 200`,
    [input.repoRoot, input.hints]
  );

  const pathHints = new Set<string>();
  const citations: Array<{
    sourceType: 'graph_node';
    sourceId: string;
    path?: string;
    score: number;
  }> = [];
  for (const row of rows.rows) {
    if (row.path) {
      pathHints.add(row.path);
    }
    if (row.connectedPath) {
      pathHints.add(row.connectedPath);
    }
    citations.push({
      sourceType: 'graph_node',
      sourceId: row.nodeId,
      path: row.path ?? undefined,
      score: 0.35,
    });
    if (row.connectedNodeId) {
      citations.push({
        sourceType: 'graph_node',
        sourceId: row.connectedNodeId,
        path: row.connectedPath ?? undefined,
        score: 0.3,
      });
    }
  }

  return {
    pathHints: [...pathHints],
    citations: dedupeGraphCitations(citations),
  };
}

function dedupeGraphCitations(
  citations: Array<{ sourceType: 'graph_node'; sourceId: string; path?: string; score: number }>
): Array<{ sourceType: 'graph_node'; sourceId: string; path?: string; score: number }> {
  const map = new Map<
    string,
    { sourceType: 'graph_node'; sourceId: string; path?: string; score: number }
  >();
  for (const citation of citations) {
    const existing = map.get(citation.sourceId);
    if (!existing || citation.score > existing.score) {
      map.set(citation.sourceId, citation);
    }
  }
  return [...map.values()];
}

function safeJsonParse(value: string | null): unknown {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
