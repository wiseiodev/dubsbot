## Context

Dubsbot already implements hybrid retrieval and logs retrieval runs, but there is no first-class proofing workflow that demonstrates hybrid retrieval improves grounding quality over lexical-only or vector-only modes. Existing tests validate ranking behavior in isolation, not end-to-end grounded answer quality against a stable benchmark.

This design introduces an evaluation layer that can be run locally and in CI, producing reproducible evidence artifacts. Constraints include deterministic scoring, low-flake execution, and compatibility with existing retrieval/indexing components.

## Goals / Non-Goals

**Goals:**
- Define a repeatable benchmark and scoring pipeline that compares `lexical`, `vector`, and `hybrid` retrieval modes.
- Produce machine-readable and human-readable reports proving whether hybrid retrieval improves grounding.
- Add enforceable quality gates that prevent regressions when hybrid no longer outperforms baseline metrics.
- Keep the framework extensible for future retrieval strategies and dataset growth.

**Non-Goals:**
- Replacing the current retrieval algorithms.
- Building a generic ML evaluation platform outside retrieval grounding use cases.
- Automating dataset generation from production traffic in this change.

## Decisions

1. Decision: Add a dedicated retrieval proofing module with a deterministic runner.
Rationale: Isolates evaluation logic from retrieval runtime paths while allowing direct invocation from CLI and CI.
Alternatives considered: Embedding proof logic directly into integration tests; rejected because reporting, artifacts, and threshold controls become difficult to manage.

2. Decision: Use a versioned benchmark fixture format checked into the repository.
Rationale: Versioned fixtures make results reproducible and reviewable in PRs.
Alternatives considered: Pulling remote benchmark datasets at runtime; rejected for nondeterminism and network dependency.

3. Decision: Define explicit grounding metrics with weighted composite scoring.
Rationale: Hybrid improvement claims should rely on measurable dimensions (evidence relevance, citation support, unsupported-claim penalty) instead of a single opaque score.
Alternatives considered: Binary pass/fail per query only; rejected because it hides partial improvements and limits tuning.

4. Decision: Emit both JSON and Markdown reports per run.
Rationale: JSON supports CI gating and trend tracking; Markdown supports quick human review in PRs/release notes.
Alternatives considered: Console-only output; rejected because it cannot be consumed reliably by automation.

5. Decision: Add configurable threshold gating in CI keyed by benchmark profile.
Rationale: Different profiles (smoke vs full) need different strictness, but all should enforce that hybrid outperforms at least one baseline and does not regress beyond tolerated deltas.
Alternatives considered: Non-blocking advisory reporting; rejected because it fails to prevent regressions.

## Risks / Trade-offs

- [Metric design overfits benchmark prompts] -> Mitigation: include diverse query classes and require periodic benchmark refresh with version bumps.
- [Evaluation flakiness from non-deterministic model output] -> Mitigation: score retrieval grounding evidence before generation where possible, and normalize scoring heuristics with deterministic parsers.
- [CI runtime increases] -> Mitigation: provide smoke profile for default CI and full profile for scheduled/deeper checks.
- [Thresholds initially too strict or too lax] -> Mitigation: bootstrap with baseline snapshot and adjust through explicit config review.

## Migration Plan

1. Introduce benchmark schema and initial fixture set.
2. Implement proofing runner and scoring engine for lexical/vector/hybrid comparisons.
3. Add report generation (`.json` + `.md`) and CLI command(s).
4. Add CI job/profile and threshold configuration.
5. Establish baseline snapshot from current main branch and document interpretation guidance.

Rollback strategy: disable CI gating profile while preserving artifact generation, then revert proofing integration if blocking issues persist.

## Open Questions

- Should evidence relevance scoring be rule-based only, or optionally allow LLM-as-judge for a secondary non-blocking signal?
- What minimum benchmark size is acceptable for default CI without significant runtime impact?
- Should threshold checks be absolute only, relative only, or a hybrid model (absolute floor + relative improvement)?
