## 1. Policy Contract and Data Model

- [x] 1.1 Define the structured policy decision envelope (`decision`, `matchedRules`, `scopeContext`, `reasonCodes`) in shared types/contracts
- [x] 1.2 Add scoped approval persistence model fields (principal, operation class, resource scope, expiration, revocation state)
- [x] 1.3 Implement approval lookup/match logic that requires exact scope-key matching before reuse

## 2. Scoped Persisted Approvals

- [x] 2.1 Implement expiration validation for persisted approvals at decision time
- [x] 2.2 Implement approval revocation by scope identifier and ensure revoked approvals are excluded from reuse
- [x] 2.3 Add tests for scope-match success, scope mismatch denial, expiration, and revocation behavior

## 3. Strict Path Allowlist Enforcement

- [x] 3.1 Implement centralized path canonicalization utility for guarded operations
- [x] 3.2 Implement allowlist matcher over canonical absolute paths with deny-by-default semantics when allowlist policy is enabled for the operation
- [x] 3.3 Integrate a mandatory guard at all file-mutation/sensitive command operation boundaries
- [x] 3.4 Add tests for in-allowlist allow, out-of-allowlist deny, missing allowlist deny in allowlist-enabled mode, interactive approval-gated fallback without allowlist, and canonicalization-failure deny

## 4. Explainable Policy Decisions

- [x] 4.1 Update policy evaluation pipeline to emit structured explanation fields for both allow and deny outcomes
- [x] 4.2 Standardize reason-code taxonomy for path enforcement and approval-scope outcomes
- [x] 4.3 Add deterministic-output tests to ensure identical inputs return identical decision explanation payloads

## 5. Rollout and Validation

- [x] 5.1 Add compatibility/adapter handling for legacy decision consumers during rollout
- [x] 5.2 Add integration tests that cover end-to-end guarded execution with scoped approvals and path allowlists
- [x] 5.3 Document operator-facing guidance for interpreting denial reasons and updating allowlists/scopes
