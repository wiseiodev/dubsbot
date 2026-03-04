## 1. Benchmark Dataset and Configuration

- [x] 1.1 Define and document versioned benchmark fixture schema for retrieval proofing cases
- [x] 1.2 Add initial benchmark dataset covering multiple query intents and grounding difficulty levels
- [x] 1.3 Implement profile-based proofing configuration (for example `smoke` and `full`) with threshold settings

## 2. Evaluation Runner and Scoring

- [x] 2.1 Implement retrieval proofing runner that executes lexical, vector, and hybrid modes over the same case set
- [x] 2.2 Implement deterministic grounding metric scoring for evidence relevance, citation support, and unsupported-claim penalty
- [x] 2.3 Add aggregate scoring and strategy delta computation suitable for pass/fail gating

## 3. Reporting and CLI Integration

- [x] 3.1 Add CLI command(s) to run retrieval proofing for a selected benchmark profile
- [x] 3.2 Generate JSON report artifacts with per-case and aggregate metrics for each strategy
- [x] 3.3 Generate Markdown summary report highlighting hybrid-vs-baseline outcomes and gate status

## 4. Quality Gates and Verification

- [x] 4.1 Integrate proofing command into CI with non-zero exit on failed hybrid thresholds
- [x] 4.2 Add tests for scoring determinism, report schema stability, and gate pass/fail behavior
- [x] 4.3 Document local and CI proofing workflows, including how to update baseline thresholds safely
