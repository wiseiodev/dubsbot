import { z } from 'zod';

export const ContextQuerySchema = z.object({
  lexicalQuery: z.string().default(''),
  vectorQuery: z.string().default(''),
  graphHints: z.array(z.string()).default([]),
  // Keep nested rerank fields explicitly required for provider JSON-schema compatibility.
  rerank: z
    .object({
      method: z.enum(['none', 'hybrid']),
      topK: z.number().int().positive(),
    })
    .default({ method: 'hybrid', topK: 20 }),
  maxItems: z.number().int().positive().default(20),
});

export type ContextQuery = z.infer<typeof ContextQuerySchema>;

export const ContextCitationSchema = z.object({
  sourceType: z.enum(['file', 'graph_node', 'chunk', 'tool']),
  sourceId: z.string(),
  path: z.string().optional(),
  score: z.number().default(0),
});

export const ContextBundleSchema = z.object({
  query: ContextQuerySchema,
  items: z
    .array(
      z.object({
        id: z.string(),
        content: z.string(),
        score: z.number().default(0),
        metadata: z.record(z.string(), z.unknown()).default({}),
      })
    )
    .default([]),
  citations: z.array(ContextCitationSchema).default([]),
});

export type ContextBundle = z.infer<typeof ContextBundleSchema>;
