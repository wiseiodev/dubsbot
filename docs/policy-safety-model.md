# Stronger Safety Model Guide

This guide explains how to interpret policy denials and adjust scoped approvals and path allowlists safely.

## Decision Envelope

Policy outcomes now include:
- `decision`: `allow`, `deny`, or `approval_required`
- `matchedRules`: stable identifiers for matched policy checks
- `scopeContext`: approval scope tuple (`principal`, `operationClass`, `resourceScope`, `scopeId`)
- `reasonCodes`: normalized denial/approval reasons

Legacy fields (`allowed`, `requiresApproval`, `reason`, `sideEffect`) remain available for compatibility.

## Actionable Reason Codes

- `approval_required_side_effect`: interactive approval is required for the operation class.
- `approval_scope_reused`: an existing scoped approval matched exactly and was reused.
- `approval_expired`: the prior scoped approval has expired and must be re-approved.
- `approval_revoked`: the scope was explicitly revoked and cannot be reused.
- `missing_allowlist`: allowlist policy is active but no valid allowlist exists for this operation.
- `path_out_of_allowlist`: at least one canonicalized path is outside allowed roots.
- `path_canonicalization_failure`: canonicalization failed for a configured root or target path.
- `blocked_command_pattern`: command matched a hard-block pattern.

## Managing Path Allowlists

Use policy config keys:
- `pathAllowlistByOperation`: operation-specific allow roots keyed by side effect (`write`, `destructive`, etc.)
- `pathAllowlist`: fallback roots when operation-specific roots are not present
- `allowlistPolicyOperations`: operation classes where strict allowlist enforcement is required

Guidance:
1. Add only absolute, canonical roots for intended write targets.
2. Keep roots narrow and operation-specific where possible.
3. For automation writes, ensure allowlists are configured before execution to avoid deny-by-default outcomes.

## Managing Scoped Approvals

Scoped approvals are keyed by:
- principal identity
- operation class
- resource scope (derived from command + cwd)

Approvals are reused only when all scope keys match exactly and the record is both unexpired and not revoked.

Revocation:
- Revoke by `scopeId` when permissions should no longer be reused.
- After revocation, the same request will return `approval_revoked` until re-approved.
