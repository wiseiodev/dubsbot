## 1. Strategy Configuration Foundation

- [x] 1.1 Introduce typed `embeddingStrategy` config schema with provider/model primary and ordered fallback entries
- [x] 1.2 Add startup validation for unknown providers, missing models, and cyclic fallback paths with structured errors
- [x] 1.3 Add backward-compatible default mapping from legacy embedding settings to explicit strategy definitions

## 2. Runtime Strategy Resolution and Anthropic Policy

- [x] 2.1 Implement deterministic strategy resolver that requires a valid strategy id for each embedding request
- [x] 2.2 Implement Anthropic native-first execution path with explicit fallback eligibility based on configured failure categories
- [x] 2.3 Enforce configured fallback order and terminal failure behavior when fallback is disallowed or exhausted

## 3. Provenance Envelope and Data Plumbing

- [x] 3.1 Define a normalized embedding result envelope including strategy id, provider/model attempt path, fallback state, and failure category
- [x] 3.2 Propagate provenance fields through indexing writes and retrieval/query responses
- [x] 3.3 Update logging/metrics hooks to include provenance identifiers for debugging and parity analysis

## 4. Verification and Rollout Safety

- [x] 4.1 Add conformance tests for valid/invalid strategy config loading and runtime resolution behavior
- [x] 4.2 Add Anthropic policy tests covering success, non-fallbackable failures, fallbackable failures, and no-fallback scenarios
- [x] 4.3 Add provenance completeness tests for both successful and terminal-failure embedding outcomes
- [x] 4.4 Gate rollout behind a feature flag and document enable/rollback procedure for staged deployment
