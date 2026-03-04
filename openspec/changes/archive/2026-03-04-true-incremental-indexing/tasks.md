## 1. Incremental Indexing Core

- [x] 1.1 Add shared file-index helpers (upsert file, replace chunks/embeddings/docs, delete file by path) for reuse by full and incremental indexers.
- [x] 1.2 Replace `runIncrementalIndex` broad fallback with a path-targeted pipeline that processes normalized changed paths only.
- [x] 1.3 Add incremental operation/result types that include inserted/updated/deleted file counts and chunk counters.

## 2. Delete Handling and Fallback Rules

- [x] 2.1 Implement explicit delete operations for `unlink` events and missing-path detection during incremental runs.
- [x] 2.2 Update daemon watcher wiring to pass enough event metadata (fs event type and git-head change context) into incremental indexing.
- [x] 2.3 Implement narrow fallback policy so only unresolved unscoped git-head transitions can trigger full reindex, with reason metadata/logging.

## 3. Verification

- [x] 3.1 Add tests for add/change targeted updates to ensure unrelated files are not reindexed.
- [x] 3.2 Add tests for delete handling to verify stale `files`/`chunks`/`chunk_embeddings`/`bm25_documents` data is removed.
- [x] 3.3 Add tests for fallback gating to verify fs path events never trigger full fallback and unresolved git-head transitions do.
