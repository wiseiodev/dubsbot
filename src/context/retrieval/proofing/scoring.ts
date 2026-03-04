import type { BenchmarkCase, CaseMetrics } from './schema';

export function scoreCaseMetrics(input: {
  benchmarkCase: BenchmarkCase;
  retrievedDocIds: string[];
}): CaseMetrics {
  const { benchmarkCase, retrievedDocIds } = input;
  const topK = benchmarkCase.topK;
  const expectedSet = new Set(benchmarkCase.expectedEvidenceDocIds);
  const top = retrievedDocIds.slice(0, topK);
  const weightedHits = top.reduce((acc, docId, index) => {
    if (!expectedSet.has(docId)) {
      return acc;
    }
    return acc + (topK - index) / topK;
  }, 0);
  const weightDenominator = top.reduce((acc, _docId, index) => acc + (topK - index) / topK, 0);
  const hits = top.filter((docId) => expectedSet.has(docId)).length;

  const evidenceRelevance = divide(weightedHits, weightDenominator);
  const citationSupportCoverage = divide(hits, benchmarkCase.expectedEvidenceDocIds.length);
  const unsupportedClaimPenalty = divide(topK - hits, topK);
  const compositeScore = clamp01(
    evidenceRelevance * 0.45 + citationSupportCoverage * 0.45 + (1 - unsupportedClaimPenalty) * 0.1
  );

  return {
    evidenceRelevance,
    citationSupportCoverage,
    unsupportedClaimPenalty,
    compositeScore,
  };
}

export function averageCaseMetrics(metrics: CaseMetrics[]): CaseMetrics {
  if (metrics.length === 0) {
    return {
      evidenceRelevance: 0,
      citationSupportCoverage: 0,
      unsupportedClaimPenalty: 1,
      compositeScore: 0,
    };
  }

  return {
    evidenceRelevance: average(metrics.map((metric) => metric.evidenceRelevance)),
    citationSupportCoverage: average(metrics.map((metric) => metric.citationSupportCoverage)),
    unsupportedClaimPenalty: average(metrics.map((metric) => metric.unsupportedClaimPenalty)),
    compositeScore: average(metrics.map((metric) => metric.compositeScore)),
  };
}

export function subtractMetrics(a: CaseMetrics, b: CaseMetrics): CaseMetrics {
  return {
    evidenceRelevance: a.evidenceRelevance - b.evidenceRelevance,
    citationSupportCoverage: a.citationSupportCoverage - b.citationSupportCoverage,
    unsupportedClaimPenalty: a.unsupportedClaimPenalty - b.unsupportedClaimPenalty,
    compositeScore: a.compositeScore - b.compositeScore,
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function divide(num: number, den: number): number {
  if (den <= 0) {
    return 0;
  }
  return num / den;
}

function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}
