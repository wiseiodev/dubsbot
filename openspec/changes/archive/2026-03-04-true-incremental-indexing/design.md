## Context

`runIncrementalIndex` currently delegates to `runFullIndex` whenever any path changes, so a single file edit can re-read and re-embed the whole repository. The daemon already emits per-path file events (`add`, `change`, `unlink`) but incremental indexing ignores event type and does not perform targeted deletes. This creates avoidable cost/latency and leaves stale rows for deleted files.

## Goals / Non-Goals

**Goals:**
- Update index records only for changed paths during normal fs-driven incremental updates.
- Remove index records for deleted paths deterministically.
- Keep a controlled fallback path for non-path-scoped updates where safe changed-path resolution is unavailable.
- Expose clear indexing result counts for inserts/updates/deletes to support monitoring and tests.

**Non-Goals:**
- Re-architect chunking strategy, embedding model selection, or retrieval ranking.
- Introduce background job queues or batch compaction mechanisms.
- Guarantee semantic diff-aware partial chunk updates within a single file (file-level replacement is acceptable).

## Decisions

### 1. Introduce a path-targeted incremental indexer pipeline
Implement `runIncrementalIndex` as a first-class pipeline that accepts normalized path change operations and processes only those paths. For changed/added files, it will upsert the `files` row, replace file-owned chunks, regenerate embeddings/documents, and return counts.

Alternative considered:
- Keep `runFullIndex` as fallback for all incremental events.
  - Rejected because it violates incremental performance expectations and increases provider cost.

### 2. Model deletes explicitly as operations, not read failures
When a path is deleted (`unlink` event or path no longer exists during processing), delete corresponding `files` row by `(repo_root, path)`. Cascades will clean dependent chunks and embeddings via FK constraints.

Alternative considered:
- Skip missing files and rely on periodic full reindex for cleanup.
  - Rejected because stale context can persist indefinitely between full reindexes.

### 3. Narrow fallback to unscoped git-head transitions
For git-head change events, attempt to compute changed paths (for example using `git diff --name-status <old> <new>`). If path resolution fails, run one explicit full fallback with metadata noting reason. Fs watcher events should never use full fallback.

Alternative considered:
- Never fallback; fail incremental run when changed paths are unknown.
  - Rejected because this can leave index freshness broken after branch switches/rebases.

### 4. Reuse shared indexing primitives between full and incremental modes
Factor file processing helpers (`indexSingleFile`, `deleteIndexedFileByPath`) out of full-index logic so full and incremental paths share chunking/embedding behavior and remain consistent.

Alternative considered:
- Duplicate logic inside `incremental.ts`.
  - Rejected due to high drift risk and higher maintenance cost.

## Risks / Trade-offs

- [Risk] Path normalization mismatches (absolute vs relative, case sensitivity) could duplicate or miss rows.
  - Mitigation: normalize all incoming paths to repo-relative POSIX form before DB operations.
- [Risk] Git diff resolution may be incomplete in edge states (detached head, shallow clones).
  - Mitigation: treat unresolved cases as explicit fallback with reason metric/log.
- [Risk] Targeted updates can increase per-event DB chatter for rapid burst edits.
  - Mitigation: optionally coalesce duplicate paths in-memory per run and process each path once.
- [Risk] Delete cascades can remove large data sets at once.
  - Mitigation: include deletion counters and tests covering large-file chunk cleanup behavior.

## Migration Plan

1. Add shared index primitives and new incremental operation model.
2. Update daemon event wiring to pass fs event type and git head metadata.
3. Add tests for add/change/delete plus fallback gating.
4. Deploy with counters/logging and verify incremental runs show bounded file counts in local daemon logs.
5. Rollback strategy: route daemon back to full indexing by toggling incremental dispatcher to `runFullIndex`.

## Open Questions

- Should git-head path resolution be introduced in this change or left as a follow-up with immediate fallback? (Default in this change: attempt resolution, fallback when unavailable.)
- Should ignored globs for full indexing and incremental events be centralized in one shared utility to prevent drift?
