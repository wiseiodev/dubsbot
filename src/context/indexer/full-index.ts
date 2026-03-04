import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import fg from 'fast-glob';
import type { DubsbotDb } from '../../db/client';
import { createProviderAdapter } from '../../providers';
import type { ProviderAdapter } from '../../providers/types';
import { isEmbeddingStrategyV2Enabled, loadEmbeddingStrategyConfig } from '../embedding/config';
import {
  assertEmbeddingSuccess,
  type EmbeddingProvenance,
  executeEmbeddingWithStrategy,
} from '../embedding/engine';
import { deterministicEmbedding } from '../retrieval/rerank';

type Chunk = {
  index: number;
  content: string;
  startLine: number;
  endLine: number;
};

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

export async function runFullIndex(input: {
  db: DubsbotDb;
  repoRoot: string;
  embedProvider?: ProviderAdapter;
  embeddingModel?: string;
  embeddingStrategyId?: string;
}): Promise<{ filesIndexed: number; chunksIndexed: number }> {
  const paths = await fg(['**/*', '!node_modules/**', '!.git/**', '!dist/**', '!coverage/**'], {
    cwd: input.repoRoot,
    dot: false,
    onlyFiles: true,
    absolute: false,
  });

  let filesIndexed = 0;
  let chunksIndexed = 0;

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

  for (const relativePath of paths) {
    const absolutePath = `${input.repoRoot}/${relativePath}`;
    const content = await readFile(absolutePath, 'utf8').catch(() => null);
    if (!content) {
      continue;
    }

    filesIndexed += 1;
    const fileId = randomUUID();
    await input.db.query(
      `INSERT INTO files (id, repo_root, path, hash, language)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (repo_root, path) DO UPDATE SET hash = EXCLUDED.hash, language = EXCLUDED.language, updated_at = NOW()
       RETURNING id`,
      [fileId, input.repoRoot, relativePath, hashContent(content), detectLanguage(relativePath)]
    );

    const fileRows = await input.db.query<{ id: string }>(
      'SELECT id FROM files WHERE repo_root = $1 AND path = $2',
      [input.repoRoot, relativePath]
    );
    const persistedFileId = fileRows.rows[0].id;

    await input.db.query('DELETE FROM chunks WHERE file_id = $1', [persistedFileId]);

    const chunks = chunkFile(content);
    for (const chunk of chunks) {
      const chunkId = randomUUID();
      chunksIndexed += 1;

      await input.db.query(
        `INSERT INTO chunks (id, file_id, chunk_index, content, start_line, end_line)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [chunkId, persistedFileId, chunk.index, chunk.content, chunk.startLine, chunk.endLine]
      );

      let embedding: number[];
      let provider = input.embedProvider ? 'remote' : 'local';
      let model = input.embeddingModel ?? 'deterministic-v1';
      let provenance: EmbeddingProvenance = {
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

      if (isStrategyV2 && strategyConfig) {
        const strategyId = input.embeddingStrategyId ?? strategyConfig.defaults.indexing;
        const result = await executeEmbeddingWithStrategy({
          config: strategyConfig,
          strategyId,
          value: chunk.content,
          adapterForProvider: getAdapter,
        });
        const success = assertEmbeddingSuccess(result);
        embedding = success.embedding;
        provider = success.provider;
        model = success.model;
        provenance = success.provenance;
        emitEmbeddingTelemetry(success.provenance);
      } else {
        embedding =
          input.embedProvider != null
            ? (
                await input.embedProvider.embed({
                  model: input.embeddingModel ?? 'text-embedding-3-small',
                  values: [chunk.content],
                })
              )[0]
            : deterministicEmbedding(chunk.content);
      }

      await input.db.query(
        `INSERT INTO chunk_embeddings (chunk_id, provider, model, embedding, provenance)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
         ON CONFLICT (chunk_id) DO UPDATE SET provider = EXCLUDED.provider, model = EXCLUDED.model, embedding = EXCLUDED.embedding, provenance = EXCLUDED.provenance`,
        [chunkId, provider, model, JSON.stringify(embedding), JSON.stringify(provenance)]
      );

      await input.db.query('INSERT INTO bm25_documents (id, chunk_id, body) VALUES ($1, $2, $3)', [
        randomUUID(),
        chunkId,
        chunk.content,
      ]);
    }
  }

  return { filesIndexed, chunksIndexed };
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
