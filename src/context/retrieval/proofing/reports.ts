import type { RetrievalProofingReport } from './schema';

export function formatProofingMarkdown(report: RetrievalProofingReport): string {
  const hybridAggregate = report.strategies.hybrid.aggregate.metrics;
  const lexicalAggregate = report.strategies.lexical.aggregate.metrics;
  const vectorAggregate = report.strategies.vector.aggregate.metrics;

  const lines = [
    '# Retrieval Quality Proofing Report',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Benchmark: ${report.benchmark.datasetName}@${report.benchmark.datasetVersion}`,
    `- Profile: ${report.profile}`,
    `- Gate: ${report.gate.passed ? 'PASS' : 'FAIL'}`,
    '',
    '## Aggregate Metrics',
    '',
    '| Strategy | Evidence Relevance | Citation Coverage | Unsupported Penalty | Composite |',
    '| --- | ---: | ---: | ---: | ---: |',
    renderAggregateRow('hybrid', hybridAggregate),
    renderAggregateRow('lexical', lexicalAggregate),
    renderAggregateRow('vector', vectorAggregate),
    '',
    '## Hybrid Deltas vs Baselines',
    '',
    '| Baseline | Evidence Relevance Δ | Citation Coverage Δ | Unsupported Penalty Δ | Composite Δ |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...report.hybridDeltas.map((entry) =>
      [
        `| ${entry.baseline}`,
        `${entry.metricDeltas.evidenceRelevance.toFixed(3)}`,
        `${entry.metricDeltas.citationSupportCoverage.toFixed(3)}`,
        `${entry.metricDeltas.unsupportedClaimPenalty.toFixed(3)}`,
        `${entry.metricDeltas.compositeScore.toFixed(3)} |`,
      ].join(' | ')
    ),
    '',
    '## Gate Status',
    '',
    report.gate.passed ? '- All configured thresholds passed.' : '- Failure reasons:',
    ...report.gate.failures.map((failure) => `  - ${failure}`),
    '',
    '## Per-Case Hybrid Summary',
    '',
    '| Case | Retrieved Doc IDs | Expected Evidence IDs | Composite |',
    '| --- | --- | --- | ---: |',
    ...report.strategies.hybrid.cases.map((entry) =>
      [
        `| ${entry.caseId}`,
        entry.retrievedDocIds.join(', '),
        entry.expectedEvidenceDocIds.join(', '),
        `${entry.metrics.compositeScore.toFixed(3)} |`,
      ].join(' | ')
    ),
  ];

  return lines.join('\n');
}

function renderAggregateRow(
  strategy: string,
  metrics: RetrievalProofingReport['strategies']['hybrid']['aggregate']['metrics']
): string {
  return `| ${strategy} | ${metrics.evidenceRelevance.toFixed(3)} | ${metrics.citationSupportCoverage.toFixed(3)} | ${metrics.unsupportedClaimPenalty.toFixed(3)} | ${metrics.compositeScore.toFixed(3)} |`;
}
