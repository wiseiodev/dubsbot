## 1. Package Contract Hardening

- [ ] 1.1 Audit and update `package.json` distribution fields (`bin`, `files`, `engines`, metadata) for global npm CLI publishing.
- [ ] 1.2 Verify build output paths and executable entrypoints in `dist/` match manifest references.
- [ ] 1.3 Add/adjust ignore or packaging controls so development-only files are excluded from publish artifacts.

## 2. Release Verification Workflow

- [ ] 2.1 Add a single release verification script/command that runs lint, typecheck, tests, and build.
- [ ] 2.2 Add a packaging smoke step that runs `npm pack`, installs the tarball in a temporary environment, and validates `dubsbot --help`.
- [ ] 2.3 Ensure the verification workflow exits non-zero on any failed gate and can be reused in CI.

## 3. CI/Automation Gate Enforcement

- [ ] 3.1 Add or update CI workflow configuration to execute release verification on release-targeted branches/tags.
- [ ] 3.2 Block publish execution when release verification fails.
- [ ] 3.3 Validate CI logs clearly show which gate failed for maintainability.

## 4. Release Documentation and Validation

- [ ] 4.1 Add maintainer-facing release documentation covering prerequisites, verification, publish, and rollback steps.
- [ ] 4.2 Update `README.md` with install/distribution notes aligned with published package behavior.
- [ ] 4.3 Run a full dry run of the documented release flow and capture any follow-up fixes before first publish.
