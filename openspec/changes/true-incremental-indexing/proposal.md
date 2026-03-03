## Why

Incremental indexing currently falls back to a full repository reindex for any change, which is slow and unnecessary for normal edits. Delete events are also not handled explicitly, so stale indexed content can persist after files are removed.

## What Changes

- Implement true incremental indexing that updates only the paths reported as changed instead of running a broad full index fallback.
- Add explicit delete handling so `unlink` and missing-path updates remove corresponding `files`, `chunks`, `chunk_embeddings`, and `bm25_documents` records.
- Preserve a narrow fallback mode only for non-path-scoped events (for example, git-head transitions where changed files cannot be resolved confidently).
- Add observability counters for updated, inserted, and deleted files/chunks to make index behavior auditable.

## Capabilities

### New Capabilities
- `incremental-indexing`: Maintain context indexes with path-targeted updates and correct delete handling for file-system and git-triggered events.

### Modified Capabilities
- None.

## Impact

- Affected code:
  - `src/context/indexer/incremental.ts`
  - `src/context/indexer/full-index.ts` (shared helpers/factoring)
  - `src/daemon/main.ts`
  - `src/context/fs-watcher.ts` / `src/context/git-watcher.ts` (event payload usage)
- Affected behavior:
  - Daemon-triggered indexing becomes fast and bounded for common file edits.
  - Index state remains correct after file deletion.
- Testing:
  - New unit/integration coverage for changed-path upsert, delete handling, and constrained fallback behavior.
