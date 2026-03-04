import { readFile } from 'node:fs/promises';
import { cosineSimilarity, deterministicEmbedding } from '../rerank';
import {
  type BenchmarkCase,
  type BenchmarkProfile,
  BenchmarkProfilesSchema,
  RetrievalBenchmarkSchema,
  type RetrievalProofingReport,
  RetrievalProofingReportSchema,
  type RetrievalProofingStrategy,
} from './schema';
import { averageCaseMetrics, scoreCaseMetrics, subtractMetrics } from './scoring';

const STRATEGIES: RetrievalProofingStrategy[] = ['lexical', 'vector', 'hybrid'];

export async function runRetrievalProofing(input: {
  benchmarkPath: string;
  profilesPath: string;
  profileName: string;
}): Promise<RetrievalProofingReport> {
  const benchmark = await loadBenchmark(input.benchmarkPath);
  const profiles = await loadProfiles(input.profilesPath);
  const profile = profiles.profiles[input.profileName];

  if (!profile) {
    throw new Error(
      `Unknown benchmark profile "${input.profileName}". Available: ${Object.keys(profiles.profiles).join(', ')}`
    );
  }

  const selectedCases = selectCases(benchmark.cases, profile);
  const strategyReports = Object.fromEntries(
    STRATEGIES.map((strategy) => {
      const cases = selectedCases.map((benchmarkCase) => {
        const retrievedDocIds = retrieveDocsForCase(benchmarkCase, strategy);
        const metrics = scoreCaseMetrics({ benchmarkCase, retrievedDocIds });
        return {
          caseId: benchmarkCase.id,
          strategy,
          retrievedDocIds,
          expectedEvidenceDocIds: benchmarkCase.expectedEvidenceDocIds,
          metrics,
        };
      });
      const aggregate = {
        strategy,
        metrics: averageCaseMetrics(cases.map((entry) => entry.metrics)),
      };
      return [strategy, { cases, aggregate }];
    })
  ) as RetrievalProofingReport['strategies'];

  const hybridAggregate = strategyReports.hybrid.aggregate.metrics;
  const lexicalAggregate = strategyReports.lexical.aggregate.metrics;
  const vectorAggregate = strategyReports.vector.aggregate.metrics;

  const hybridDeltas = [
    {
      baseline: 'lexical' as const,
      metricDeltas: subtractMetrics(hybridAggregate, lexicalAggregate),
    },
    {
      baseline: 'vector' as const,
      metricDeltas: subtractMetrics(hybridAggregate, vectorAggregate),
    },
  ];

  const gateFailures = evaluateGate({
    profile,
    hybridAggregate,
    lexicalAggregate,
    vectorAggregate,
  });

  return RetrievalProofingReportSchema.parse({
    schemaVersion: '1.0',
    benchmark: {
      datasetName: benchmark.datasetName,
      datasetVersion: benchmark.datasetVersion,
    },
    profile: input.profileName,
    generatedAt: new Date().toISOString(),
    strategies: strategyReports,
    hybridDeltas,
    gate: {
      passed: gateFailures.length === 0,
      failures: gateFailures,
    },
  });
}

function evaluateGate(input: {
  profile: BenchmarkProfile;
  hybridAggregate: RetrievalProofingReport['strategies']['hybrid']['aggregate']['metrics'];
  lexicalAggregate: RetrievalProofingReport['strategies']['lexical']['aggregate']['metrics'];
  vectorAggregate: RetrievalProofingReport['strategies']['vector']['aggregate']['metrics'];
}): string[] {
  const failures: string[] = [];
  const minimums = input.profile.thresholds.hybridMinimums;
  const deltas = input.profile.thresholds.baselineDeltaFloors;
  const hybrid = input.hybridAggregate;

  if (hybrid.evidenceRelevance < minimums.evidenceRelevance) {
    failures.push(
      `hybrid evidenceRelevance ${hybrid.evidenceRelevance.toFixed(3)} < ${minimums.evidenceRelevance.toFixed(3)}`
    );
  }
  if (hybrid.citationSupportCoverage < minimums.citationSupportCoverage) {
    failures.push(
      `hybrid citationSupportCoverage ${hybrid.citationSupportCoverage.toFixed(3)} < ${minimums.citationSupportCoverage.toFixed(3)}`
    );
  }
  if (hybrid.compositeScore < minimums.compositeScore) {
    failures.push(
      `hybrid compositeScore ${hybrid.compositeScore.toFixed(3)} < ${minimums.compositeScore.toFixed(3)}`
    );
  }
  if (hybrid.unsupportedClaimPenalty > minimums.maxUnsupportedClaimPenalty) {
    failures.push(
      `hybrid unsupportedClaimPenalty ${hybrid.unsupportedClaimPenalty.toFixed(3)} > ${minimums.maxUnsupportedClaimPenalty.toFixed(3)}`
    );
  }

  const hybridVsLexical = hybrid.compositeScore - input.lexicalAggregate.compositeScore;
  if (hybridVsLexical < deltas.lexical) {
    failures.push(
      `hybrid-vs-lexical composite delta ${hybridVsLexical.toFixed(3)} < ${deltas.lexical.toFixed(3)}`
    );
  }

  const hybridVsVector = hybrid.compositeScore - input.vectorAggregate.compositeScore;
  if (hybridVsVector < deltas.vector) {
    failures.push(
      `hybrid-vs-vector composite delta ${hybridVsVector.toFixed(3)} < ${deltas.vector.toFixed(3)}`
    );
  }

  return failures;
}

function selectCases(cases: BenchmarkCase[], profile: BenchmarkProfile): BenchmarkCase[] {
  if (!profile.caseIds || profile.caseIds.length === 0) {
    return cases;
  }

  const wanted = new Set(profile.caseIds);
  const selected = cases.filter((entry) => wanted.has(entry.id));
  if (selected.length !== profile.caseIds.length) {
    const selectedIds = new Set(selected.map((entry) => entry.id));
    const missing = profile.caseIds.filter((id) => !selectedIds.has(id));
    throw new Error(`Profile references missing benchmark case IDs: ${missing.join(', ')}`);
  }
  return selected;
}

function retrieveDocsForCase(
  benchmarkCase: BenchmarkCase,
  strategy: RetrievalProofingStrategy
): string[] {
  const rows = benchmarkCase.documents.map((doc) => {
    const lexicalScore = computeLexicalScore(benchmarkCase.query, `${doc.title} ${doc.content}`);
    const vectorScore = cosineSimilarity(
      deterministicEmbedding(benchmarkCase.query),
      deterministicEmbedding(`${doc.title} ${doc.content}`)
    );
    const totalScore =
      strategy === 'lexical'
        ? lexicalScore
        : strategy === 'vector'
          ? vectorScore
          : lexicalScore * 0.7 + vectorScore * 0.3;

    return {
      id: doc.id,
      totalScore,
    };
  });

  return rows
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, benchmarkCase.topK)
    .map((entry) => entry.id);
}

function computeLexicalScore(query: string, haystack: string): number {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
  if (tokens.length === 0) {
    return 0;
  }

  const source = haystack.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (source.includes(token)) {
      score += 1;
    }
  }

  return score / tokens.length;
}

async function loadBenchmark(path: string) {
  const raw = await readFile(path, 'utf8');
  return RetrievalBenchmarkSchema.parse(JSON.parse(raw));
}

async function loadProfiles(path: string) {
  const raw = await readFile(path, 'utf8');
  return BenchmarkProfilesSchema.parse(JSON.parse(raw));
}
