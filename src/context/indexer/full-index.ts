import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import fg from 'fast-glob';
import type { DubsbotDb } from '../../db/client';
import type { ProviderAdapter } from '../../providers/types';
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
}): Promise<{ filesIndexed: number; chunksIndexed: number }> {
  const paths = await fg(['**/*', '!node_modules/**', '!.git/**', '!dist/**', '!coverage/**'], {
    cwd: input.repoRoot,
    dot: false,
    onlyFiles: true,
    absolute: false,
  });

  let filesIndexed = 0;
  let chunksIndexed = 0;

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

      const embedding =
        input.embedProvider != null
          ? (
              await input.embedProvider.embed({
                model: input.embeddingModel ?? 'text-embedding-3-small',
                values: [chunk.content],
              })
            )[0]
          : deterministicEmbedding(chunk.content);

      await input.db.query(
        `INSERT INTO chunk_embeddings (chunk_id, provider, model, embedding)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (chunk_id) DO UPDATE SET provider = EXCLUDED.provider, model = EXCLUDED.model, embedding = EXCLUDED.embedding`,
        [
          chunkId,
          input.embedProvider ? 'remote' : 'local',
          input.embeddingModel ?? 'deterministic-v1',
          JSON.stringify(embedding),
        ]
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
