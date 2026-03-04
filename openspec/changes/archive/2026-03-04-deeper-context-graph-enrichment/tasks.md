## 1. Schema and data model updates

- [x] 1.1 Add symbol node schema/types with canonical symbol identifier fields and source location metadata
- [x] 1.2 Add normalized edge type enum support for `defines`, `references`, `imports`, and `calls`
- [x] 1.3 Add feature-flag or configuration gate for enabling symbol enrichment rollout

## 2. Symbol extraction pipeline

- [x] 2.1 Implement symbol extraction for initial supported languages (TypeScript/JavaScript) in the indexing pipeline
- [x] 2.2 Generate deterministic canonical symbol keys (`<repo>::<path>::<kind>::<name>::<range-hash>`) during extraction
- [x] 2.3 Add extraction diagnostics and partial-failure handling so unsupported constructs do not halt full indexing

## 3. Relationship edge generation

- [x] 3.1 Implement `defines` edge generation from file entities to declared symbols
- [x] 3.2 Implement `references` and `calls` edge generation from analyzed source contexts to target symbols when resolvable
- [x] 3.3 Implement `imports` edge generation between importing context and imported symbol/module entities

## 4. Graph persistence and query integration

- [x] 4.1 Persist symbol nodes and semantic edges in graph storage with batch write path support
- [x] 4.2 Update graph query/retrieval surfaces to return symbol nodes and semantic edge traversals
- [x] 4.3 Ensure existing file-level graph query contracts remain unchanged when enrichment is enabled

## 5. Validation, testing, and rollout checks

- [x] 5.1 Add golden fixture tests for symbol extraction counts and canonical identifier stability
- [x] 5.2 Add tests for required edge presence and directionality (`defines`, `references`, `imports`, `calls`)
- [x] 5.3 Add regression tests verifying file-level query compatibility and non-breaking behavior
- [x] 5.4 Add indexing performance/volume checks and acceptance thresholds for enriched graph data
