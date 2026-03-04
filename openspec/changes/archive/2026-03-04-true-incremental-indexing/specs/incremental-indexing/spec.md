## ADDED Requirements

### Requirement: Incremental indexing MUST process only targeted changed paths
The indexing system MUST support an incremental mode that updates only the files identified in a change set, without scanning or reprocessing unrelated repository paths.

#### Scenario: Single-file change updates only that file
- **WHEN** incremental indexing is invoked with one changed path
- **THEN** only that path is read, re-chunked, and re-embedded
- **AND** unrelated indexed files remain untouched

#### Scenario: Duplicate changed paths are coalesced
- **WHEN** incremental indexing receives repeated entries for the same path in one run
- **THEN** the path is processed once
- **AND** result counters reflect a single file operation for that path

### Requirement: Incremental indexing MUST handle deletes correctly
The indexing system MUST remove indexed records for files that were deleted from the repository, including dependent chunks and retrieval documents.

#### Scenario: File unlink removes indexed content
- **WHEN** incremental indexing is invoked for a path marked as deleted
- **THEN** the indexed file row for that repo/path is removed
- **AND** all dependent chunks, embeddings, and bm25 documents are removed via cascade or equivalent guarantees

#### Scenario: Missing file during change processing is treated as delete
- **WHEN** incremental indexing receives a changed path that no longer exists on disk
- **THEN** the system treats that path as a delete operation
- **AND** stale indexed content for the path is removed

### Requirement: Full reindex fallback MUST be narrow and explicit
The indexing system MUST avoid broad full-reindex fallback for normal path-scoped file-system events and MAY fallback only for unscoped events where changed paths cannot be determined safely.

#### Scenario: File-system add/change/unlink does not trigger full fallback
- **WHEN** incremental indexing is triggered from file-system events with concrete paths
- **THEN** the run completes through targeted path operations only
- **AND** full repository indexing is not invoked

#### Scenario: Unscoped git-head change can fallback with reason
- **WHEN** a git-head transition occurs and changed paths cannot be resolved reliably
- **THEN** the system runs a single explicit full fallback reindex
- **AND** emits metadata or logs indicating fallback reason and trigger type

### Requirement: Incremental runs MUST expose operation counts
The indexing system MUST return operation counters that distinguish inserted/updated/deleted files and indexed chunks for each run.

#### Scenario: Result includes delete counts
- **WHEN** a run processes at least one delete operation
- **THEN** the result includes a non-zero deleted-file count
- **AND** chunk counters reflect removed and/or replaced chunk totals
