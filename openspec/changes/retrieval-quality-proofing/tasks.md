## 1. Benchmark Dataset and Configuration

- [ ] 1.1 Define and document versioned benchmark fixture schema for retrieval proofing cases
- [ ] 1.2 Add initial benchmark dataset covering multiple query intents and grounding difficulty levels
- [ ] 1.3 Implement profile-based proofing configuration (for example `smoke` and `full`) with threshold settings

## 2. Evaluation Runner and Scoring

- [ ] 2.1 Implement retrieval proofing runner that executes lexical, vector, and hybrid modes over the same case set
- [ ] 2.2 Implement deterministic grounding metric scoring for evidence relevance, citation support, and unsupported-claim penalty
- [ ] 2.3 Add aggregate scoring and strategy delta computation suitable for pass/fail gating

## 3. Reporting and CLI Integration

- [ ] 3.1 Add CLI command(s) to run retrieval proofing for a selected benchmark profile
- [ ] 3.2 Generate JSON report artifacts with per-case and aggregate metrics for each strategy
- [ ] 3.3 Generate Markdown summary report highlighting hybrid-vs-baseline outcomes and gate status

## 4. Quality Gates and Verification

- [ ] 4.1 Integrate proofing command into CI with non-zero exit on failed hybrid thresholds
- [ ] 4.2 Add tests for scoring determinism, report schema stability, and gate pass/fail behavior
- [ ] 4.3 Document local and CI proofing workflows, including how to update baseline thresholds safely
