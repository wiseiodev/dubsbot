import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { DubsbotDb } from '../../db/client';
import { createProviderAdapter } from '../../providers';
import type { ProviderAdapter } from '../../providers/types';
import { isEmbeddingStrategyV2Enabled, loadEmbeddingStrategyConfig } from '../embedding/config';
import {
  assertEmbeddingSuccess,
  type EmbeddingProvenance,
  executeEmbeddingWithStrategy,
} from '../embedding/engine';
import { isSymbolEnrichmentEnabled } from '../graph/config';
import { extractGraphDataForFile } from '../graph/extract';
import { deleteGraphEnrichmentForFile, persistGraphEnrichmentForFile } from '../graph/persist';
import { deterministicEmbedding } from '../retrieval/rerank';

type Chunk = {
  index: number;
  content: string;
  startLine: number;
  endLine: number;
};

export type FileIndexSharedInput = {
  db: DubsbotDb;
  repoRoot: string;
  embedProvider?: ProviderAdapter;
  embeddingModel?: string;
  embeddingStrategyId?: string;
  symbolEnrichmentEnabled?: boolean;
};

export type UpsertFileResult = {
  status: 'indexed' | 'missing';
  fileStatus?: 'inserted' | 'updated';
  chunksInserted: number;
  chunksDeleted: number;
};

export type DeleteFileResult = {
  fileDeleted: boolean;
  chunksDeleted: number;
};

export function createFileIndexHelpers(input: FileIndexSharedInput): {
  upsertIndexedFileByPath: (relativePath: string) => Promise<UpsertFileResult>;
  deleteIndexedFileByPath: (relativePath: string) => Promise<DeleteFileResult>;
} {
  const symbolEnrichmentEnabled = input.symbolEnrichmentEnabled ?? isSymbolEnrichmentEnabled();
  const isStrategyV2 = isEmbeddingStrategyV2Enabled();
  const strategyConfig = isStrategyV2 ? loadEmbeddingStrategyConfig() : null;
  const adapterCache = new Map<string, ProviderAdapter>();

  function getAdapter(provider: string): ProviderAdapter {
    const cached = adapterCache.get(provider);
    if (cached) {
      return cached;
    }
    const adapter = createProviderAdapter(provider as 'openai' | 'anthropic' | 'google');
    adapterCache.set(provider, adapter);
    return adapter;
  }

  async function embedContent(chunkContent: string): Promise<{
    embedding: number[];
    provider: string;
    model: string;
    provenance: EmbeddingProvenance;
  }> {
    if (isStrategyV2 && strategyConfig) {
      const strategyId = input.embeddingStrategyId ?? strategyConfig.defaults.indexing;
      const result = await executeEmbeddingWithStrategy({
        config: strategyConfig,
        strategyId,
        value: chunkContent,
        adapterForProvider: getAdapter,
      });
      const success = assertEmbeddingSuccess(result);
      emitEmbeddingTelemetry(success.provenance);
      return {
        embedding: success.embedding,
        provider: success.provider,
        model: success.model,
        provenance: success.provenance,
      };
    }

    const provider = input.embedProvider ? 'remote' : 'local';
    const model =
      input.embeddingModel ?? (input.embedProvider ? 'text-embedding-3-small' : 'deterministic-v1');
    const embedding =
      input.embedProvider != null
        ? (await input.embedProvider.embed({ model, values: [chunkContent] }))[0]
        : deterministicEmbedding(chunkContent);
    const provenance: EmbeddingProvenance = {
      strategyId: 'legacy-default',
      attemptPath: [
        {
          strategyId: 'legacy-default',
          provider,
          model,
          status: 'success',
        },
      ],
      fallbackUsed: false,
      resolvedBy: {
        strategyId: 'legacy-default',
        provider,
        model,
      },
    };

    return { embedding, provider, model, provenance };
  }

  async function upsertIndexedFileByPath(relativePath: string): Promise<UpsertFileResult> {
    const absolutePath = `${input.repoRoot}/${relativePath}`;
    const content = await readFile(absolutePath, 'utf8').catch(() => null);
    if (!content) {
      return { status: 'missing', chunksInserted: 0, chunksDeleted: 0 };
    }

    const existingRows = await input.db.query<{ id: string }>(
      'SELECT id FROM files WHERE repo_root = $1 AND path = $2',
      [input.repoRoot, relativePath]
    );
    const existingFileId = existingRows.rows[0]?.id;
    const fileStatus: 'inserted' | 'updated' = existingFileId ? 'updated' : 'inserted';

    const fileId = existingFileId ?? randomUUID();
    const persistedRows = await input.db.query<{ id: string }>(
      `INSERT INTO files (id, repo_root, path, hash, language)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (repo_root, path) DO UPDATE SET hash = EXCLUDED.hash, language = EXCLUDED.language, updated_at = NOW()
       RETURNING id`,
      [fileId, input.repoRoot, relativePath, hashContent(content), detectLanguage(relativePath)]
    );
    const persistedFileId = persistedRows.rows[0].id;

    let chunksDeleted = 0;
    if (existingFileId) {
      const deletedRows = await input.db.query<{ count: number | string }>(
        'SELECT COUNT(*)::int AS count FROM chunks WHERE file_id = $1',
        [persistedFileId]
      );
      chunksDeleted = Number(deletedRows.rows[0]?.count ?? 0);
    }

    await input.db.query('DELETE FROM chunks WHERE file_id = $1', [persistedFileId]);

    const chunks = chunkFile(content);
    for (const chunk of chunks) {
      const chunkId = randomUUID();
      await input.db.query(
        `INSERT INTO chunks (id, file_id, chunk_index, content, start_line, end_line)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [chunkId, persistedFileId, chunk.index, chunk.content, chunk.startLine, chunk.endLine]
      );

      const embedded = await embedContent(chunk.content);
      await input.db.query(
        `INSERT INTO chunk_embeddings (chunk_id, provider, model, embedding, provenance)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
         ON CONFLICT (chunk_id) DO UPDATE SET provider = EXCLUDED.provider, model = EXCLUDED.model, embedding = EXCLUDED.embedding, provenance = EXCLUDED.provenance`,
        [
          chunkId,
          embedded.provider,
          embedded.model,
          JSON.stringify(embedded.embedding),
          JSON.stringify(embedded.provenance),
        ]
      );

      await input.db.query('INSERT INTO bm25_documents (id, chunk_id, body) VALUES ($1, $2, $3)', [
        randomUUID(),
        chunkId,
        chunk.content,
      ]);
    }

    if (symbolEnrichmentEnabled) {
      try {
        const extraction = extractGraphDataForFile({
          repoRoot: input.repoRoot,
          path: relativePath,
          content,
        });
        await persistGraphEnrichmentForFile({
          db: input.db,
          repoRoot: input.repoRoot,
          path: relativePath,
          extraction,
        });
        for (const diagnostic of extraction.diagnostics) {
          console.info(`[indexer:graph] ${diagnostic}`);
        }
      } catch (error) {
        console.warn(
          `[indexer:graph] extraction failed for ${relativePath}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    return {
      status: 'indexed',
      fileStatus,
      chunksInserted: chunks.length,
      chunksDeleted,
    };
  }

  async function deleteIndexedFileByPath(relativePath: string): Promise<DeleteFileResult> {
    const fileRows = await input.db.query<{ id: string }>(
      'SELECT id FROM files WHERE repo_root = $1 AND path = $2',
      [input.repoRoot, relativePath]
    );
    const fileId = fileRows.rows[0]?.id;
    if (!fileId) {
      return { fileDeleted: false, chunksDeleted: 0 };
    }

    const countRows = await input.db.query<{ count: number | string }>(
      'SELECT COUNT(*)::int AS count FROM chunks WHERE file_id = $1',
      [fileId]
    );
    const chunksDeleted = Number(countRows.rows[0]?.count ?? 0);
    await input.db.query('DELETE FROM files WHERE id = $1', [fileId]);
    if (symbolEnrichmentEnabled) {
      await deleteGraphEnrichmentForFile({
        db: input.db,
        repoRoot: input.repoRoot,
        path: relativePath,
      }).catch((error) => {
        console.warn(
          `[indexer:graph] cleanup failed for ${relativePath}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      });
    }
    return { fileDeleted: true, chunksDeleted };
  }

  return {
    upsertIndexedFileByPath,
    deleteIndexedFileByPath,
  };
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function detectLanguage(path: string): string {
  const extension = path.split('.').at(-1)?.toLowerCase();
  switch (extension) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'py':
      return 'python';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    default:
      return 'text';
  }
}

function chunkFile(content: string, linesPerChunk = 120): Chunk[] {
  const lines = content.split('\n');
  const chunks: Chunk[] = [];
  for (let i = 0; i < lines.length; i += linesPerChunk) {
    const startLine = i + 1;
    const endLine = Math.min(i + linesPerChunk, lines.length);
    chunks.push({
      index: chunks.length,
      content: lines.slice(i, endLine).join('\n'),
      startLine,
      endLine,
    });
  }
  return chunks;
}

function emitEmbeddingTelemetry(provenance: EmbeddingProvenance): void {
  if (process.env.DUBSBOT_EMBEDDING_PROVENANCE_LOG !== '1') {
    return;
  }
  const resolved = provenance.resolvedBy
    ? `${provenance.resolvedBy.provider}:${provenance.resolvedBy.model}`
    : 'none';
  console.info(
    `[embedding] strategy=${provenance.strategyId} resolved=${resolved} fallback=${provenance.fallbackUsed} attempts=${provenance.attemptPath
      .map((attempt) => `${attempt.provider}:${attempt.model}:${attempt.status}`)
      .join('>')}`
  );
}
