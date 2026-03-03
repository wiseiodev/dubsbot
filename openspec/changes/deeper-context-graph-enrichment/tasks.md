## 1. Schema and data model updates

- [ ] 1.1 Add symbol node schema/types with canonical symbol identifier fields and source location metadata
- [ ] 1.2 Add normalized edge type enum support for `defines`, `references`, `imports`, and `calls`
- [ ] 1.3 Add feature-flag or configuration gate for enabling symbol enrichment rollout

## 2. Symbol extraction pipeline

- [ ] 2.1 Implement symbol extraction for initial supported languages (TypeScript/JavaScript) in the indexing pipeline
- [ ] 2.2 Generate deterministic canonical symbol keys (`<repo>::<path>::<kind>::<name>::<range-hash>`) during extraction
- [ ] 2.3 Add extraction diagnostics and partial-failure handling so unsupported constructs do not halt full indexing

## 3. Relationship edge generation

- [ ] 3.1 Implement `defines` edge generation from file entities to declared symbols
- [ ] 3.2 Implement `references` and `calls` edge generation from analyzed source contexts to target symbols when resolvable
- [ ] 3.3 Implement `imports` edge generation between importing context and imported symbol/module entities

## 4. Graph persistence and query integration

- [ ] 4.1 Persist symbol nodes and semantic edges in graph storage with batch write path support
- [ ] 4.2 Update graph query/retrieval surfaces to return symbol nodes and semantic edge traversals
- [ ] 4.3 Ensure existing file-level graph query contracts remain unchanged when enrichment is enabled

## 5. Validation, testing, and rollout checks

- [ ] 5.1 Add golden fixture tests for symbol extraction counts and canonical identifier stability
- [ ] 5.2 Add tests for required edge presence and directionality (`defines`, `references`, `imports`, `calls`)
- [ ] 5.3 Add regression tests verifying file-level query compatibility and non-breaking behavior
- [ ] 5.4 Add indexing performance/volume checks and acceptance thresholds for enriched graph data
