import { z } from 'zod';
import { type ToolSideEffect, ToolSideEffectSchema } from '../tools/schemas';
import { PolicyReasonCode } from './reason-codes';

const PathAllowlistByOperationSchema: z.ZodType<Partial<Record<ToolSideEffect, string[]>>> = z
  .object({
    read: z.array(z.string()).optional(),
    write: z.array(z.string()).optional(),
    destructive: z.array(z.string()).optional(),
    network: z.array(z.string()).optional(),
  })
  .default({});

export const ApprovalPolicySchema = z.object({
  requireApprovalFor: z.array(ToolSideEffectSchema).default(['write', 'destructive', 'network']),
  commandAllowlist: z.array(z.string()).default([]),
  pathAllowlist: z.array(z.string()).default([]),
  automationWriteAllowlist: z.array(z.string()).default([]),
  pathAllowlistByOperation: PathAllowlistByOperationSchema,
  allowlistPolicyOperations: z.array(ToolSideEffectSchema).default(['write']),
  approvalTtlMs: z
    .number()
    .int()
    .positive()
    .default(10 * 60 * 1000),
  blockedCommandPatterns: z.array(z.string()).default(['rm -rf /', 'mkfs', 'dd if=']),
});

export type ApprovalPolicy = z.infer<typeof ApprovalPolicySchema>;

export const LegacyApprovalDecisionSchema = z.object({
  allowed: z.boolean(),
  requiresApproval: z.boolean(),
  reason: z.string(),
  sideEffect: ToolSideEffectSchema,
});

const PolicyDecisionSchema = z.enum(['allow', 'deny', 'approval_required']);

const ApprovalScopeContextSchema = z.object({
  principal: z.string(),
  operationClass: ToolSideEffectSchema,
  resourceScope: z.string(),
  scopeId: z.string(),
  expiresAt: z.string().nullable().default(null),
  revoked: z.boolean().default(false),
});

export const ApprovalDecisionSchema = z.object({
  ...LegacyApprovalDecisionSchema.shape,
  decision: PolicyDecisionSchema,
  matchedRules: z.array(z.string()).default([]),
  scopeContext: ApprovalScopeContextSchema,
  reasonCodes: z
    .array(
      z.enum([
        PolicyReasonCode.blockedCommandPattern,
        PolicyReasonCode.automationAllowlistMatch,
        PolicyReasonCode.automationAllowlistMiss,
        PolicyReasonCode.approvalRequiredSideEffect,
        PolicyReasonCode.approvalScopeGranted,
        PolicyReasonCode.approvalScopeReused,
        PolicyReasonCode.approvalExpired,
        PolicyReasonCode.approvalRevoked,
        PolicyReasonCode.missingAllowlist,
        PolicyReasonCode.missingTargetPaths,
        PolicyReasonCode.pathAllowlistMatch,
        PolicyReasonCode.pathOutOfAllowlist,
        PolicyReasonCode.canonicalizationFailure,
        PolicyReasonCode.allowedByPolicy,
      ])
    )
    .default([]),
});

export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
export type LegacyApprovalDecision = z.infer<typeof LegacyApprovalDecisionSchema>;

export function toLegacyApprovalDecision(input: ApprovalDecision): LegacyApprovalDecision {
  return {
    allowed: input.allowed,
    requiresApproval: input.requiresApproval,
    reason: input.reason,
    sideEffect: input.sideEffect,
  };
}
