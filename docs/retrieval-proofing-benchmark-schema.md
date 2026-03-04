# Retrieval Proofing Benchmark Schema (v1.0)

This document defines the versioned fixture format used by retrieval proofing.

## Fixture File

Path: `benchmarks/retrieval-proofing/benchmark.v1.json`

Top-level shape:

```json
{
  "version": "1.0",
  "datasetName": "retrieval-proofing-core",
  "datasetVersion": "2026.03.01",
  "cases": [
    {
      "id": "repo-layout",
      "title": "Find retrieval implementation location",
      "query": "where is hybrid retrieval implemented",
      "intent": "lookup",
      "difficulty": "low",
      "topK": 3,
      "expectedEvidenceDocIds": ["d1", "d2"],
      "documents": [
        {
          "id": "d1",
          "path": "src/context/retrieval/hybrid.ts",
          "title": "Hybrid retrieval source",
          "content": "..."
        },
        {
          "id": "d2",
          "path": "src/context/retrieval/rerank.ts",
          "title": "Rerank helpers",
          "content": "..."
        }
      ]
    }
  ]
}
```

## Field Semantics

- `version`: Fixture schema version. Must be `1.0` for this release.
- `datasetName`: Human-readable benchmark dataset name.
- `datasetVersion`: Version of benchmark content. Bump when case content or labels change.
- `cases`: Benchmark case list.
- `cases[].id`: Stable identifier used by profile filters and reports.
- `cases[].query`: Query string used by all retrieval strategies.
- `cases[].topK`: Number of retrieved documents considered for scoring.
- `cases[].documents`: Candidate evidence set for the case.
- `cases[].expectedEvidenceDocIds`: Canonical evidence documents used for deterministic scoring.

## Profile File

Path: `benchmarks/retrieval-proofing/profiles.v1.json`

- `version`: Profile schema version (`1.0`).
- `profiles.<name>.caseIds`: Optional subset of case IDs for this profile.
- `profiles.<name>.thresholds.hybridMinimums`: Absolute floors for hybrid metrics.
- `profiles.<name>.thresholds.baselineDeltaFloors`: Minimum hybrid-vs-baseline composite deltas.

## Versioning Rules

- Bump `datasetVersion` whenever benchmark content changes.
- Keep schema `version` at `1.0` unless the JSON structure changes.
- Prefer adding new cases over mutating existing case IDs to preserve comparability.
