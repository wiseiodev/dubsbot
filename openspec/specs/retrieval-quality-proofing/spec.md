# retrieval-quality-proofing Specification

## Purpose
Define how the system evaluates, compares, and enforces retrieval quality across lexical, vector,
and hybrid strategies using deterministic benchmarks, grounding-focused metrics, and
CI-enforceable quality gates.
## Requirements
### Requirement: Multi-Strategy Retrieval Evaluation
The system MUST execute the same benchmark question set against at least three retrieval strategies: lexical-only, vector-only, and hybrid.

#### Scenario: Compare strategies on shared benchmark
- **WHEN** a proofing run starts for a benchmark profile
- **THEN** the system runs every benchmark case across lexical, vector, and hybrid modes using identical inputs and scoring configuration

### Requirement: Deterministic Grounding Metrics
The system MUST calculate deterministic grounding metrics for each benchmark case and strategy, including evidence relevance, citation support coverage, and unsupported-claim penalty.

#### Scenario: Produce deterministic scores
- **WHEN** the same benchmark profile and repository state are evaluated multiple times
- **THEN** the computed grounding metrics and aggregate scores are identical across runs except for explicitly declared non-deterministic fields

### Requirement: Versioned Benchmark and Report Artifacts
The system MUST support versioned benchmark fixtures and emit both machine-readable and human-readable report artifacts for every proofing run.

#### Scenario: Generate proof artifacts
- **WHEN** a proofing run completes
- **THEN** the system writes a JSON report containing per-case and aggregate metric values and writes a Markdown summary highlighting strategy deltas and pass/fail gate status

### Requirement: Hybrid Quality Gate Enforcement
The system MUST enforce configurable quality gates that verify hybrid retrieval outperforms configured baseline strategies on grounding metrics.

#### Scenario: Gate fails on hybrid regression
- **WHEN** a proofing run determines that hybrid retrieval does not meet configured improvement thresholds versus baseline
- **THEN** the command exits non-zero and marks the run as failed for CI enforcement

#### Scenario: Gate passes on acceptable hybrid improvement
- **WHEN** a proofing run determines that hybrid retrieval meets configured improvement thresholds versus baseline
- **THEN** the command exits zero and marks the run as passing
