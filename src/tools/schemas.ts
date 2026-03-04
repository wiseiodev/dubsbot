import { z } from 'zod';

export const ToolSideEffectSchema = z.enum(['read', 'write', 'destructive', 'network']);
export type ToolSideEffect = z.infer<typeof ToolSideEffectSchema>;

export const ToolInvocationSchema = z.object({
  tool: z.string().min(1),
  params: z.record(z.string(), z.unknown()).default({}),
  sideEffect: ToolSideEffectSchema,
  policyTag: z.string().default('default'),
});

export type ToolInvocation = z.infer<typeof ToolInvocationSchema>;

export const ToolResultSchema = z.object({
  tool: z.string().min(1),
  ok: z.boolean(),
  summary: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  stdout: z.string().default(''),
  stderr: z.string().default(''),
  exitCode: z.number().int().default(0),
});

export type ToolResult = z.infer<typeof ToolResultSchema>;
