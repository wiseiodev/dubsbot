import { createHash } from 'node:crypto';
import type { DubsbotDb } from '../../db/client';
import { type GraphFileExtraction, SemanticEdgeTypes } from './types';

export async function persistGraphEnrichmentForFile(input: {
  db: DubsbotDb;
  repoRoot: string;
  path: string;
  extraction: GraphFileExtraction;
}): Promise<void> {
  const fileKey = fileNodeKey(input.repoRoot, input.path);
  const prefix = `${input.repoRoot}::${input.path}::`;

  await input.db.exec('BEGIN');
  try {
    const scopedNodes = await input.db.query<{ id: string }>(
      'SELECT id FROM context_nodes WHERE node_key LIKE $1',
      [`${prefix}%`]
    );
    const scopedNodeIds = scopedNodes.rows.map((row) => row.id);

    if (scopedNodeIds.length > 0) {
      await input.db.query(
        'DELETE FROM context_edges WHERE source_node_id = ANY($1::text[]) OR target_node_id = ANY($1::text[])',
        [scopedNodeIds]
      );
      await input.db.query(
        'DELETE FROM context_nodes WHERE id = ANY($1::text[]) AND node_key <> $2',
        [scopedNodeIds, fileKey]
      );
    }

    await upsertNode(input.db, {
      id: nodeId(fileKey),
      type: 'file',
      key: fileKey,
      payload: {
        repoRoot: input.repoRoot,
        path: input.path,
      },
    });

    const idsByKey = new Map<string, string>([[fileKey, nodeId(fileKey)]]);
    for (const symbol of input.extraction.symbols) {
      const key = symbol.id;
      const id = nodeId(key);
      idsByKey.set(key, id);
      await upsertNode(input.db, {
        id,
        type: 'symbol',
        key,
        payload: {
          repoRoot: input.repoRoot,
          id: symbol.id,
          kind: symbol.kind,
          name: symbol.name,
          path: symbol.path,
          location: symbol.location,
          diagnostics: symbol.diagnostics ?? [],
        },
      });
    }

    for (const edge of input.extraction.edges) {
      if (!SemanticEdgeTypes.includes(edge.type)) {
        continue;
      }
      const sourceNodeId = idsByKey.get(edge.sourceKey);
      const targetNodeId = idsByKey.get(edge.targetKey);
      if (!sourceNodeId || !targetNodeId) {
        continue;
      }
      const id = edgeId(edge.type, sourceNodeId, targetNodeId);
      await input.db.query(
        `INSERT INTO context_edges (id, source_node_id, target_node_id, edge_type, weight, payload)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT (id) DO UPDATE SET edge_type = EXCLUDED.edge_type, weight = EXCLUDED.weight, payload = EXCLUDED.payload`,
        [
          id,
          sourceNodeId,
          targetNodeId,
          edge.type,
          edge.confidence ?? 1,
          JSON.stringify(edge.metadata ?? {}),
        ]
      );
    }

    await input.db.exec('COMMIT');
  } catch (error) {
    await input.db.exec('ROLLBACK');
    throw error;
  }
}

export async function deleteGraphEnrichmentForFile(input: {
  db: DubsbotDb;
  repoRoot: string;
  path: string;
}): Promise<void> {
  const prefix = `${input.repoRoot}::${input.path}::`;
  const scopedNodes = await input.db.query<{ id: string }>(
    'SELECT id FROM context_nodes WHERE node_key LIKE $1',
    [`${prefix}%`]
  );
  const scopedNodeIds = scopedNodes.rows.map((row) => row.id);
  if (scopedNodeIds.length === 0) {
    return;
  }

  await input.db.exec('BEGIN');
  try {
    await input.db.query(
      'DELETE FROM context_edges WHERE source_node_id = ANY($1::text[]) OR target_node_id = ANY($1::text[])',
      [scopedNodeIds]
    );
    await input.db.query('DELETE FROM context_nodes WHERE id = ANY($1::text[])', [scopedNodeIds]);
    await input.db.exec('COMMIT');
  } catch (error) {
    await input.db.exec('ROLLBACK');
    throw error;
  }
}

async function upsertNode(
  db: DubsbotDb,
  input: { id: string; type: 'file' | 'symbol'; key: string; payload: Record<string, unknown> }
): Promise<void> {
  await db.query(
    `INSERT INTO context_nodes (id, node_type, node_key, payload)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (node_key) DO UPDATE SET node_type = EXCLUDED.node_type, payload = EXCLUDED.payload, updated_at = NOW()`,
    [input.id, input.type, input.key, JSON.stringify(input.payload)]
  );
}

function fileNodeKey(repoRoot: string, path: string): string {
  return `${repoRoot}::${path}::file`;
}

function nodeId(key: string): string {
  return createHash('sha1').update(key).digest('hex');
}

function edgeId(type: string, sourceNodeId: string, targetNodeId: string): string {
  return createHash('sha1').update(`${type}|${sourceNodeId}|${targetNodeId}`).digest('hex');
}
