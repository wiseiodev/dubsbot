import { z } from 'zod';
import { ContextQuerySchema } from '../../context/schemas';
import { ToolInvocationSchema } from '../../tools/schemas';

export const AgentTurnEnvelopeSchema = z.object({
  turnType: z.enum(['plan', 'assistant', 'tool', 'error', 'final']),
  intent: z.object({
    goal: z.string().min(1),
    confidence: z.number().min(0).max(1),
  }),
  contextRequest: ContextQuerySchema,
  toolPlan: z.array(ToolInvocationSchema).default([]),
  approvalRequest: z
    .object({
      reason: z.string().min(1),
      commands: z.array(z.string()).default([]),
      paths: z.array(z.string()).default([]),
    })
    .nullable(),
  assistantResponse: z.object({
    message: z.string().min(1),
    bullets: z.array(z.string()).default([]),
    codeBlocks: z
      .array(
        z.object({
          language: z.string().default('text'),
          content: z.string().min(1),
        })
      )
      .default([]),
  }),
  termination: z.object({
    shouldEnd: z.boolean(),
    reason: z.string().default(''),
  }),
});

export type AgentTurnEnvelope = z.infer<typeof AgentTurnEnvelopeSchema>;
