## Context

Today the context graph is primarily file-level, which limits precision for impact analysis and code navigation. The enrichment change introduces symbol-level nodes and semantic edges (`defines`, `references`, `imports`, `calls`) across multiple modules: parsing/extraction, graph construction, persistence, and query traversal. The implementation must preserve compatibility for existing file-level consumers and tolerate language/parser gaps without failing full indexing.

## Goals / Non-Goals

**Goals:**
- Extract stable symbol records during indexing for supported languages.
- Represent symbol relationships with normalized edge types and directional semantics.
- Persist symbols and edges with source locations and deterministic identifiers.
- Keep existing file-level graph queries functional without behavior regressions.
- Add validation and tests for extraction/edge correctness.

**Non-Goals:**
- Building full interprocedural analysis or type inference engines.
- Perfect symbol resolution for every language construct on first iteration.
- Replacing existing graph storage technology.
- Introducing user-facing UI changes in this change set.

## Decisions

1. Introduce explicit symbol node schema alongside file nodes.
Rationale: symbol-level identifiers allow precise graph traversal and avoid overloading file nodes.
Alternative considered: storing symbols as file-node metadata only. Rejected because metadata-only structures make relationship queries and deduplication harder.

2. Use a canonical symbol key format (`<repo>::<path>::<kind>::<name>::<range-hash>`).
Rationale: deterministic IDs support incremental re-indexing and reduce duplicate nodes across runs.
Alternative considered: random UUID generation per run. Rejected because it breaks stable references and diffing.

3. Normalize relationship edges to a bounded enum (`defines`, `references`, `imports`, `calls`) with optional confidence metadata.
Rationale: bounded edge types simplify query APIs and downstream ranking.
Alternative considered: free-form edge labels from each parser. Rejected due to schema drift and inconsistent semantics.

4. Apply best-effort extraction with partial-failure isolation.
Rationale: an unsupported construct in one file should not block indexing of the rest of the repository.
Alternative considered: fail-fast index jobs when any parser error appears. Rejected because resilience is more valuable for large heterogeneous codebases.

5. Maintain dual-path query compatibility by including file-level adjacency and symbol traversal.
Rationale: this enables gradual adoption and avoids breaking existing graph consumers.
Alternative considered: forcing all consumers to migrate to symbol-first queries immediately. Rejected due to migration risk.

## Risks / Trade-offs

- [Parser variance across languages may reduce edge quality] -> Mitigation: start with supported language subset, emit confidence scores, and log extraction diagnostics.
- [Graph size growth from symbol nodes/edges may affect indexing time] -> Mitigation: cap low-value symbols initially, benchmark per language, and optimize batch persistence.
- [Over-linking from noisy references can degrade retrieval relevance] -> Mitigation: apply edge validation rules and scoring thresholds before persistence.
- [Compatibility regressions in existing file-level queries] -> Mitigation: add regression tests that assert old query behavior remains unchanged.

## Migration Plan

1. Add schema changes for symbol nodes and edge enum support behind an internal feature flag.
2. Enable extraction and persistence in shadow mode, collecting metrics without affecting primary query ranking.
3. Validate edge quality and indexing overhead on representative repositories.
4. Turn on symbol traversal for internal consumers, then default-enable for all graph queries.
5. Keep rollback path by disabling enrichment flag and falling back to file-level graph construction.

## Open Questions

- Which language adapters should be included in v1 beyond TypeScript/JavaScript?
- Should `calls` edges require high-confidence callee resolution, or allow unresolved targets with lower confidence?
- Do we need TTL/compaction policy updates for increased graph volume?
