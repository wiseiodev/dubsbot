# Retrieval Quality Proofing

Retrieval proofing evaluates `lexical`, `vector`, and `hybrid` strategies on the same benchmark dataset, emits JSON/Markdown artifacts, and enforces hybrid quality gates.

## Run Locally

Smoke profile:

```bash
pnpm dev retrieval-proof --profile smoke
```

Full profile:

```bash
pnpm dev retrieval-proof --profile full
```

Custom output directory:

```bash
pnpm dev retrieval-proof --profile smoke --output-dir artifacts/retrieval-proofing
```

## Artifacts

Each run writes:

- `<profile>-<timestamp>.json`: per-case metrics, aggregate metrics, hybrid deltas, gate result.
- `<profile>-<timestamp>.md`: concise human-readable summary for PR/release notes.

Default output path:

- `artifacts/retrieval-proofing/`

## CI Workflow

PR checks run retrieval proofing with the smoke profile:

```bash
pnpm dev retrieval-proof --profile smoke --output-dir artifacts/retrieval-proofing
```

If hybrid thresholds fail, the command exits non-zero and CI fails.

## Updating Baseline Thresholds Safely

1. Run the full profile locally and inspect both JSON and Markdown reports.
2. Confirm changes are intentional and linked to retrieval behavior changes.
3. Update thresholds in `benchmarks/retrieval-proofing/profiles.v1.json`.
4. Re-run both `smoke` and `full` profiles and ensure results are stable.
5. Include rationale for threshold changes in PR description (what changed and why).

Avoid lowering thresholds to mask regressions. Prefer improving retrieval behavior first.
