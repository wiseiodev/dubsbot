## Why

The current context graph does not capture symbol-level structure, which limits navigation, impact analysis, and downstream retrieval quality. We need richer semantic edges now so graph queries can reason over real code relationships instead of file-level proximity.

## What Changes

- Add symbol extraction during indexing for key code entities (functions, classes, methods, types, constants, and modules where available).
- Emit normalized relationship edges between symbols and files for `defines`, `references`, `imports`, and `calls`.
- Persist symbol and edge metadata in the graph store with stable identifiers and source locations.
- Extend graph-building and query surfaces to include symbol nodes and relationship traversal without breaking existing file-level behavior.
- Add validation and test coverage for extraction accuracy, edge correctness, and language-specific fallbacks.

## Capabilities

### New Capabilities
- `context-graph-enrichment`: Enriches the context graph with extracted symbols and semantic relationship edges (`defines`, `references`, `imports`, `calls`) for deeper code understanding.

### Modified Capabilities
- None.

## Impact

- Affected systems: indexer pipeline, parser/extraction adapters, graph schema/storage layer, query/retrieval logic, and observability for indexing quality.
- Affected code areas: context graph builders, language analysis modules, graph persistence models, and test fixtures.
- External/API impact: graph consumers can query additional node/edge types; existing file-level graph usage remains supported.
