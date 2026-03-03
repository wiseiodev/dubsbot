import type { ApprovalPolicy } from './schemas';

export function createDefaultApprovalPolicy(
  overrides: Partial<ApprovalPolicy> = {}
): ApprovalPolicy {
  return {
    requireApprovalFor: ['write', 'destructive', 'network'],
    commandAllowlist: ['ls', 'cat', 'rg', 'find', 'pwd', 'git status'],
    pathAllowlist: [],
    automationWriteAllowlist: [],
    pathAllowlistByOperation: {},
    allowlistPolicyOperations: ['write'],
    approvalTtlMs: 10 * 60 * 1000,
    blockedCommandPatterns: ['rm -rf /', 'mkfs', 'dd if=', ':(){ :|:& };:'],
    ...overrides,
  };
}
