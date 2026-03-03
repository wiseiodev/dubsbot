import { z } from 'zod';

export const AutomationTriggerSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('schedule'),
    cron: z.string().min(1),
  }),
  z.object({
    type: z.literal('event'),
    eventName: z.string().min(1),
    pattern: z.string().optional(),
  }),
]);

export const AutomationSpecSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  trigger: AutomationTriggerSchema,
  prompt: z.string().min(1),
  workspace: z.string().min(1),
  writePolicy: z.enum(['read-only', 'safe-write', 'interactive']).default('safe-write'),
  retries: z.number().int().min(0).max(5).default(2),
});

export type AutomationSpec = z.infer<typeof AutomationSpecSchema>;

export const HookSpecSchema = z.object({
  id: z.string().min(1),
  eventName: z.string().min(1),
  command: z.string().min(1),
  enabled: z.boolean().default(true),
  timeoutMs: z.number().int().positive().default(60_000),
});

export type HookSpec = z.infer<typeof HookSpecSchema>;
