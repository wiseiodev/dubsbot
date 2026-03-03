export const PolicyReasonCode = {
  blockedCommandPattern: 'blocked_command_pattern',
  automationAllowlistMatch: 'automation_write_allowlist_match',
  automationAllowlistMiss: 'automation_write_allowlist_miss',
  approvalRequiredSideEffect: 'approval_required_side_effect',
  approvalScopeReused: 'approval_scope_reused',
  approvalScopeMismatch: 'approval_scope_mismatch',
  approvalExpired: 'approval_expired',
  approvalRevoked: 'approval_revoked',
  missingAllowlist: 'missing_allowlist',
  pathAllowlistMatch: 'path_allowlist_match',
  pathOutOfAllowlist: 'path_out_of_allowlist',
  canonicalizationFailure: 'path_canonicalization_failure',
  allowedByPolicy: 'allowed_by_policy',
} as const;

export type PolicyReasonCodeValue = (typeof PolicyReasonCode)[keyof typeof PolicyReasonCode];
