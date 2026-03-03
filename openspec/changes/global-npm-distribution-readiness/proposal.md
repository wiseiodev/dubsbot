## Why

Dubsbot currently runs from source for local development, but it is not yet set up for reliable global npm distribution. We need a publishable package contract and release gating so every tagged release is installable, reproducible, and quality-checked before publication.

## What Changes

- Define package-level requirements for global npm CLI distribution, including `bin` behavior, Node engine policy, included files, and install/runtime expectations.
- Define release gating requirements that must pass before publish (lint, typecheck, tests, build, and smoke validation of installed CLI).
- Add an explicit versioning and release flow contract (pre-release checks, publish step, and rollback/disable guidance).
- Add release-facing documentation so maintainers can execute a repeatable publish process without tribal knowledge.

## Capabilities

### New Capabilities
- `npm-publishable-package`: Standardizes what must be true for Dubsbot to be safely published and consumed as a global npm CLI package.
- `release-gating`: Defines mandatory quality gates and release workflow checks that block publication when unmet.

### Modified Capabilities
- None.

## Impact

- Affected code/config: `package.json`, build output layout in `dist/`, and release scripts or CI workflow definitions.
- Affected docs: `README.md` plus a dedicated release/publishing guide.
- Operational impact: maintainers gain a deterministic publish checklist and automated gates; failed gates prevent shipping broken artifacts.
