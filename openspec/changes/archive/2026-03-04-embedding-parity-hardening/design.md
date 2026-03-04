## Context

Dubsbot currently routes embedding generation through provider-specific paths, but selection and fallback behavior are implicit in code paths rather than explicitly configured. This creates inconsistent behavior between providers and makes failures hard to reason about, especially when Anthropic is unavailable or partially degraded. We also lack a canonical provenance envelope that survives indexing and retrieval boundaries, which limits debugging and parity validation.

This change spans configuration, provider adapters, embedding execution, and metadata storage/transport. Stakeholders are engineering teams responsible for search/retrieval quality, incident response, and cost/performance optimization.

## Goals / Non-Goals

**Goals:**
- Introduce an explicit embedding strategy contract that is provider-configurable and validated at startup.
- Define deterministic Anthropic native-first behavior with explicit fallback sequencing and terminal failure semantics.
- Persist embedding provenance metadata (strategy, provider, model, fallback path, and failure reason when applicable) through indexing and retrieval flows.
- Make parity behavior testable with provider-agnostic conformance scenarios.

**Non-Goals:**
- Replacing the existing vector store or retrieval ranking algorithm.
- Introducing automatic dynamic cost optimization across providers.
- Backfilling historical records that were indexed before provenance fields exist.

## Decisions

1. Introduce a first-class `embeddingStrategy` configuration model.
- Decision: Add a typed strategy object keyed by logical embedding use-case (for example: indexing, query, rerank-support), with explicit provider/model and ordered fallback list.
- Rationale: Centralizing strategy selection prevents hidden runtime branching and enables strict validation.
- Alternative considered: Keep provider defaults hardcoded in adapters. Rejected because behavior remains opaque and difficult to test.

2. Define Anthropic execution policy as native-first with guarded fallback.
- Decision: Anthropic attempts native embedding first when configured; fallback is allowed only to strategies explicitly listed in configuration and only for enumerated retryable failures.
- Rationale: Prevents accidental cross-provider drift and uncontrolled fail-open behavior.
- Alternative considered: Always fallback to a global default on any Anthropic error. Rejected due to silent quality drift and provenance ambiguity.

3. Standardize embedding result envelope with provenance.
- Decision: Every embedding response returns vector payload plus provenance fields: `strategyId`, `provider`, `model`, `attemptPath`, `resolvedBy`, `fallbackUsed`, and optional `failureCategory`.
- Rationale: A normalized envelope enables consistent storage, observability, and post-hoc audits.
- Alternative considered: Emit provenance only in logs. Rejected because logs are lossy and detached from indexed artifacts.

4. Enforce parity through conformance tests.
- Decision: Add contract tests for strategy resolution, Anthropic native/fallback transitions, and provenance completeness.
- Rationale: Prevents regressions as providers and adapters evolve.
- Alternative considered: Validate only with integration smoke tests. Rejected due to low scenario coverage.

## Risks / Trade-offs

- [Config complexity increases for operators] -> Mitigation: ship sane defaults, schema validation, and clear error messages on invalid strategy graphs.
- [Fallback restrictions may increase hard failures during outages] -> Mitigation: document explicit fallback policy and provide opt-in fallback paths per environment.
- [Provenance metadata adds payload/storage overhead] -> Mitigation: keep fields compact and bounded; avoid storing verbose error bodies.
- [Provider SDK behavior differences may break assumptions] -> Mitigation: isolate adapter mapping logic and add provider-specific conformance fixtures.

## Migration Plan

1. Add config schema and parser with backward-compatible defaults mapping current behavior to explicit strategy definitions.
2. Implement strategy resolution and Anthropic execution policy behind a feature gate.
3. Introduce provenance envelope in embedding pipeline and plumb through indexing/retrieval metadata.
4. Enable conformance tests and staged rollout in non-production environment.
5. Flip default to new strategy engine after validation; retain rollback by disabling feature gate.

Rollback strategy: disable the feature gate to return to legacy embedding path while preserving read compatibility for newly written provenance fields.

## Open Questions

- Should Anthropic fallback eligibility be controlled only by error category, or also by request latency thresholds?
- Which provenance fields must be queryable in runtime dashboards versus retained only for offline analysis?
- Do we require strict model parity between indexing and query strategies, or permit explicit cross-model pairings?
