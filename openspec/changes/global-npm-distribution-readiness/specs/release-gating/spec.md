## ADDED Requirements

### Requirement: Release verification gate is mandatory before publish
The release process MUST run a single verification workflow before publication, and publication MUST NOT proceed if any gate fails.

#### Scenario: Gate failure blocks publication
- **WHEN** lint, typecheck, tests, build, or package smoke checks fail
- **THEN** the release workflow exits non-zero and publish is not executed

### Requirement: Release gate includes quality and packaging checks
The release verification workflow SHALL include linting, type checking, test execution, production build generation, and packaged CLI smoke validation.

#### Scenario: Full gate sequence is executed
- **WHEN** a maintainer runs the release verification command
- **THEN** each required check runs in sequence (or equivalent orchestrated form) and reports pass/fail status

### Requirement: Release process is documented and reproducible
The repository MUST provide maintainer-facing release documentation describing prerequisites, verification steps, publish procedure, and rollback guidance.

#### Scenario: Maintainer follows documented release flow
- **WHEN** a maintainer prepares a release using project documentation
- **THEN** they can complete verification and publish steps without relying on undocumented tribal knowledge
