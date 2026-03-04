import { z } from 'zod';

export const RetrievalProofingStrategySchema = z.enum(['lexical', 'vector', 'hybrid']);
export type RetrievalProofingStrategy = z.infer<typeof RetrievalProofingStrategySchema>;

export const BenchmarkDocumentSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
});

export const BenchmarkCaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  query: z.string().min(1),
  intent: z.string().min(1),
  difficulty: z.enum(['low', 'medium', 'high']),
  topK: z.number().int().positive().default(3),
  documents: z.array(BenchmarkDocumentSchema).min(2),
  expectedEvidenceDocIds: z.array(z.string().min(1)).min(1),
});
export type BenchmarkCase = z.infer<typeof BenchmarkCaseSchema>;

export const RetrievalBenchmarkSchema = z.object({
  version: z.literal('1.0'),
  datasetName: z.string().min(1),
  datasetVersion: z.string().min(1),
  cases: z.array(BenchmarkCaseSchema).min(1),
});
export type RetrievalBenchmark = z.infer<typeof RetrievalBenchmarkSchema>;

export const ProofingThresholdsSchema = z.object({
  hybridMinimums: z.object({
    evidenceRelevance: z.number().min(0).max(1),
    citationSupportCoverage: z.number().min(0).max(1),
    compositeScore: z.number().min(0).max(1),
    maxUnsupportedClaimPenalty: z.number().min(0).max(1),
  }),
  baselineDeltaFloors: z.object({
    lexical: z.number(),
    vector: z.number(),
  }),
});
export type ProofingThresholds = z.infer<typeof ProofingThresholdsSchema>;

export const BenchmarkProfileSchema = z.object({
  description: z.string().min(1),
  caseIds: z.array(z.string().min(1)).optional(),
  thresholds: ProofingThresholdsSchema,
});
export type BenchmarkProfile = z.infer<typeof BenchmarkProfileSchema>;

export const BenchmarkProfilesSchema = z.object({
  version: z.literal('1.0'),
  profiles: z.record(z.string(), BenchmarkProfileSchema),
});
export type BenchmarkProfiles = z.infer<typeof BenchmarkProfilesSchema>;

export const CaseMetricsSchema = z.object({
  evidenceRelevance: z.number().min(0).max(1),
  citationSupportCoverage: z.number().min(0).max(1),
  unsupportedClaimPenalty: z.number().min(0).max(1),
  compositeScore: z.number().min(0).max(1),
});
export type CaseMetrics = z.infer<typeof CaseMetricsSchema>;

export const StrategyCaseResultSchema = z.object({
  caseId: z.string(),
  strategy: RetrievalProofingStrategySchema,
  retrievedDocIds: z.array(z.string()),
  expectedEvidenceDocIds: z.array(z.string()),
  metrics: CaseMetricsSchema,
});
export type StrategyCaseResult = z.infer<typeof StrategyCaseResultSchema>;

export const StrategyAggregateSchema = z.object({
  strategy: RetrievalProofingStrategySchema,
  metrics: CaseMetricsSchema,
});
export type StrategyAggregate = z.infer<typeof StrategyAggregateSchema>;

export const StrategyDeltaSchema = z.object({
  baseline: z.enum(['lexical', 'vector']),
  metricDeltas: z.object({
    evidenceRelevance: z.number(),
    citationSupportCoverage: z.number(),
    unsupportedClaimPenalty: z.number(),
    compositeScore: z.number(),
  }),
});
export type StrategyDelta = z.infer<typeof StrategyDeltaSchema>;

export const GateResultSchema = z.object({
  passed: z.boolean(),
  failures: z.array(z.string()),
});
export type GateResult = z.infer<typeof GateResultSchema>;

export const RetrievalProofingReportSchema = z.object({
  schemaVersion: z.literal('1.0'),
  benchmark: z.object({
    datasetName: z.string(),
    datasetVersion: z.string(),
  }),
  profile: z.string(),
  generatedAt: z.string(),
  strategies: z.record(
    RetrievalProofingStrategySchema,
    z.object({
      cases: z.array(StrategyCaseResultSchema),
      aggregate: StrategyAggregateSchema,
    })
  ),
  hybridDeltas: z.array(StrategyDeltaSchema),
  gate: GateResultSchema,
});
export type RetrievalProofingReport = z.infer<typeof RetrievalProofingReportSchema>;
