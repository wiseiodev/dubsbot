import { z } from 'zod';
import { ToolSideEffectSchema } from '../tools/schemas';

export const ApprovalPolicySchema = z.object({
  requireApprovalFor: z.array(ToolSideEffectSchema).default(['write', 'destructive', 'network']),
  commandAllowlist: z.array(z.string()).default([]),
  pathAllowlist: z.array(z.string()).default([]),
  automationWriteAllowlist: z.array(z.string()).default([]),
  blockedCommandPatterns: z.array(z.string()).default(['rm -rf /', 'mkfs', 'dd if=']),
});

export type ApprovalPolicy = z.infer<typeof ApprovalPolicySchema>;

export const ApprovalDecisionSchema = z.object({
  allowed: z.boolean(),
  requiresApproval: z.boolean(),
  reason: z.string(),
  sideEffect: ToolSideEffectSchema,
});

export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
