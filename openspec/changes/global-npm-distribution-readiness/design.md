## Context

Dubsbot currently has a working TypeScript build and CLI entrypoint, but distribution is optimized for local development (`pnpm dev`) rather than global install via npm. The project needs a reliable release path where package shape, runtime compatibility, and quality gates are enforced before publication. Maintainers should be able to follow one documented process that works both locally and in CI.

## Goals / Non-Goals

**Goals:**
- Ensure published npm artifacts are minimal, installable, and runnable as `dubsbot` after global install.
- Introduce deterministic release gates that block publish when quality or packaging checks fail.
- Define a repeatable release workflow with clear preflight, publish, and validation steps.
- Keep the solution compatible with existing pnpm + TypeScript + tsup tooling.

**Non-Goals:**
- Replacing the existing build stack (no migration away from tsup/pnpm in this change).
- Introducing fully automated semantic release/version orchestration.
- Changing core product features unrelated to distribution and release safety.

## Decisions

1. Package contract is defined in `package.json` and validated before publish.
- Decision: Lock down distribution metadata (`bin`, `files`, `exports`/entrypoints as needed, `engines`, `license`, `repository`, and publish config).
- Rationale: npm consumers depend on package metadata correctness for install and execution behavior.
- Alternative considered: rely on implicit npm defaults. Rejected because it risks shipping extra files or missing runtime assets.

2. Release gates run as a dedicated prepublish verification pipeline.
- Decision: Add a release verification command (or script chain) that runs lint, typecheck, tests, build, and CLI smoke checks against built artifacts.
- Rationale: this centralizes release quality policy and can be reused locally and in CI.
- Alternative considered: leave checks split across ad-hoc commands. Rejected due to inconsistent execution and high human error risk.

3. CLI smoke check validates global-install behavior from packed artifact.
- Decision: Validate `npm pack` output and run an install/execute smoke test (e.g., temporary global/prefix install and `dubsbot --help`/`--version`).
- Rationale: catches broken `bin` mappings and missing runtime files before publication.
- Alternative considered: unit tests only. Rejected because unit tests do not guarantee packaged artifact integrity.

4. Release workflow is documented and guarded in CI for tagged/main releases.
- Decision: Add a documented release runbook plus CI gating for publish-targeted workflows.
- Rationale: avoids tribal knowledge and ensures every release follows the same controls.
- Alternative considered: local-only release checklist. Rejected because CI enforcement is needed for consistency.

## Risks / Trade-offs

- [Higher release latency] -> Mitigation: keep smoke checks lightweight and cache dependency installs.
- [False negatives from environment-specific smoke tests] -> Mitigation: use deterministic temp directories and explicit Node/pnpm versions.
- [Overly strict engine constraints limiting users] -> Mitigation: align `engines.node` with tested runtime matrix and document support policy.
- [Maintainer friction from new process] -> Mitigation: provide a single command and concise runbook.

## Migration Plan

1. Introduce package metadata and release verification scripts without enabling publish automation.
2. Add CI workflow/job to run release verification on release-triggering branches/tags.
3. Update docs with a release checklist and failure troubleshooting.
4. Dry-run using `npm pack` and pre-release tags, then enable normal publish flow.

Rollback strategy:
- If release gating causes blocking regressions, disable CI enforcement temporarily while keeping local verification commands available.
- Revert metadata/script changes in a patch release if published package behavior regresses.

## Open Questions

- Should publish remain fully manual (`npm publish`) or use a guarded CI publish step after gates pass?
- Do we need provenance/signature support (e.g., npm provenance) in scope now or in a follow-up?
- Should we enforce a changelog format/versioning policy in this change or treat it as separate governance work?
