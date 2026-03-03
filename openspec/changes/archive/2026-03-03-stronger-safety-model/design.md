## Context

The current safety flow allows approvals to persist too broadly and does not consistently enforce path boundaries before sensitive operations. Policy outcomes are also difficult to audit because decisions are often opaque. This change spans approval persistence, guard enforcement, and policy output contracts, so it requires a cross-cutting design that keeps behavior deterministic and observable.

## Goals / Non-Goals

**Goals:**
- Introduce persisted approvals that are explicitly scoped by actor, operation class, and target context.
- Enforce canonical path allowlists with deny-by-default behavior when allowlist policy applies, while preserving approval-gated behavior by default.
- Produce structured policy decision explanations that can be surfaced in CLI/UI and logs.
- Keep policy evaluation deterministic so identical input yields identical decision + rationale.

**Non-Goals:**
- Replacing the entire policy engine or rewriting unrelated authorization flows.
- Building a full policy authoring UI in this change.
- Introducing broad behavioral exceptions that bypass allowlist enforcement.

## Decisions

1. Approval records are scope-bound tuples
- Decision: Persist approvals as tuples keyed by principal, action class, resource scope, and expiration metadata.
- Rationale: Prevents lateral reuse of approvals across unrelated operations.
- Alternatives considered:
  - Session-wide approval token: rejected because it over-grants and is hard to audit.
  - One-time approvals only: rejected because it harms usability for repeated safe actions.

2. Path checks use canonicalized absolute paths
- Decision: Resolve requested paths to canonical absolute paths before policy evaluation and allowlist matching.
- Rationale: Eliminates traversal and symlink bypass classes where raw input appears in-allowlist but resolved target is not.
- Alternatives considered:
  - Raw string prefix match: rejected due to bypass risk and platform inconsistency.
  - Glob-only runtime matching without canonicalization: rejected because it fails on equivalent-path edge cases.

3. Deny-by-default guard at operation boundary
- Decision: Introduce a mandatory guard that executes prior to file mutation/sensitive command execution. If allowlist policy applies for the operation, proceed only on explicit allowlist match; otherwise preserve approval-gated flow.
- Rationale: Ensures no callsite can accidentally skip policy checks while keeping v1 interactive approval semantics.
- Alternatives considered:
  - Best-effort checks in individual callsites: rejected due to drift and incomplete coverage.

4. Decision envelope includes explanation contract
- Decision: Policy engine returns `decision`, `matchedRules`, `scopeContext`, and `reasonCodes` in a stable schema.
- Rationale: Enables user-facing explanations and machine-readable audit diagnostics.
- Alternatives considered:
  - Free-form message strings only: rejected because they are not reliable for telemetry or automation.

## Risks / Trade-offs

- [Risk] Existing workflows may be denied when allowlist policy is enabled but misconfigured. -> Mitigation: ship clear reason codes and operator documentation for allowlist/scope updates.
- [Risk] Canonicalization differences across OS/filesystems may create edge-case mismatches. -> Mitigation: centralize path normalization utility with platform-focused tests.
- [Risk] Additional policy metadata may increase log verbosity. -> Mitigation: support structured fields with level-based filtering.
- [Trade-off] Stricter controls may add friction to frequent operations. -> Mitigation: scoped persisted approvals reduce repeat prompts without broad over-permission.

## Migration Plan

1. Introduce new policy schema and approval-scope model behind compatibility handling.
2. Integrate path guard middleware at all protected operation boundaries.
3. Roll out explainable decision output to logs/CLI surfaces.
4. Validate behavior with policy regression tests and targeted integration scenarios.
5. Remove legacy broad-approval fallback after validation window.

Rollback strategy:
- Revert to previous decision envelope adapter and disable strict scoped-approval enforcement flag if critical regressions occur.
- Keep audit logging enabled during rollback to capture failing patterns.

## Open Questions

- What default expiration window should scoped persisted approvals use for best security/usability balance?
- Should allowlists support per-operation-class entries (read/write/execute) from day one or phase two?
- Which reason codes should be treated as user-actionable vs operator-actionable in product surfaces?
