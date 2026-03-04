## Why

Hybrid retrieval is a core claim in Dubsbot, but we do not yet have repeatable, quantitative proof that it improves grounding quality over lexical-only or vector-only baselines. We need measurable evidence now so retrieval decisions are based on data, not intuition, and regressions are caught early.

## What Changes

- Add an evaluation harness that runs the same question set against multiple retrieval modes (`lexical`, `vector`, `hybrid`) and records comparable outputs.
- Define grounding-focused quality metrics (for example citation coverage, evidence relevance, unsupported-claim rate) with deterministic scoring rules.
- Introduce a versioned benchmark dataset and expected report format so results are reproducible across machines and commits.
- Add a CLI/reporting workflow that produces machine-readable artifacts plus a human summary suitable for release notes and PR discussion.
- Add CI verification thresholds that fail when hybrid retrieval no longer outperforms configured baselines on grounding metrics.

## Capabilities

### New Capabilities
- `retrieval-quality-proofing`: Evaluate retrieval strategies with reproducible grounding metrics and enforce performance gates for hybrid retrieval.

### Modified Capabilities
- None.

## Impact

- Affected systems: retrieval pipeline interfaces, evaluation tooling, benchmark fixtures, CI quality gates, and documentation for running/reading quality reports.
- Affected code areas likely include `src/context/retrieval`, CLI command surfaces, and `tests`/new evaluation fixtures.
- Introduces new data artifacts (benchmark inputs, scoring outputs, summary reports) that need stable schema/versioning.
