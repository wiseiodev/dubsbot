## Why

The current safety model does not provide strong enough guarantees around approval persistence scope, path-level execution boundaries, or policy transparency. We need stricter and explainable controls now to reduce accidental overreach and make operator trust and auditing practical.

## What Changes

- Introduce scoped persisted approvals that are bound to explicit context (scope, actor, and operation type) rather than broad session-wide reuse.
- Enforce strict path-based allowlist checks where allowlist policy is configured (including automation safe-write paths) while preserving approval-gated behavior by default.
- Add explainable policy decisions so every allow/deny result includes machine- and human-readable rationale.
- Standardize policy evaluation outputs so downstream logging, UI, and audit systems can consume consistent decision metadata.

## Capabilities

### New Capabilities
- `scoped-persisted-approvals`: Persist approvals with explicit scope boundaries, validity rules, and safe reuse constraints.
- `path-allowlist-enforcement`: Enforce canonicalized path allowlists for guarded operations when allowlist policy applies, with deny-by-default behavior outside allowed roots.
- `explainable-policy-decisions`: Produce structured, deterministic explanations for policy outcomes, including rule matches and denial reasons.

### Modified Capabilities
- None.

## Impact

- Affected systems: policy engine, approval storage/lookup logic, command/file guard middleware, and audit/logging outputs.
- APIs/contracts: policy decision schema will expand to include explanation metadata and scoped-approval context.
- Operational impact: stricter denial behavior may block previously permitted edge cases until allowlists/scopes are configured.
