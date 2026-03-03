import { runFullIndex } from '../../context/indexer/full-index';
import { createRuntime } from '../runtime';

export async function runIndexCommand(repoRoot: string): Promise<void> {
  const runtime = await createRuntime();

  const result = await runFullIndex({
    db: runtime.db,
    repoRoot,
    embedProvider: runtime.provider,
  });

  console.log(
    `Indexed ${result.filesIndexed} files and ${result.chunksIndexed} chunks in ${repoRoot}`
  );
}
