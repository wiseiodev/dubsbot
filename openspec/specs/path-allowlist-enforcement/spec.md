# path-allowlist-enforcement Specification

## Purpose
Define canonical path-allowlist enforcement behavior for guarded file mutations and sensitive commands, including deny-by-default handling for missing or invalid policy inputs.
## Requirements
### Requirement: Guarded operations MUST enforce canonical path allowlists
For every guarded file-system mutation or sensitive command operation that uses allowlist policy (including automation safe-write policy), the system MUST resolve target paths to canonical absolute paths before evaluating allowlists. The operation SHALL proceed only if every target path is contained within an allowed root for that operation.

#### Scenario: Canonical in-allowlist path is permitted
- **WHEN** all requested target paths canonicalize to locations within configured allowed roots
- **THEN** the operation is permitted subject to other policy checks

#### Scenario: Canonical out-of-allowlist path is denied
- **WHEN** any requested target path canonicalizes outside configured allowed roots
- **THEN** the system denies the operation with a path-allowlist denial reason

### Requirement: Path enforcement SHALL be deny-by-default
The system SHALL deny guarded operations when allowlist policy is configured but is absent for the requested operation, invalid, or cannot be evaluated. In interactive mode where no allowlist policy is configured for that operation, the system SHALL fall back to approval-gated policy flow.

#### Scenario: Missing allowlist configuration denies operation
- **WHEN** an operation is evaluated under allowlist policy and no valid allowlist is available
- **THEN** the system denies the operation and returns an explicit missing-allowlist reason

#### Scenario: Interactive mode without allowlist remains approval-gated
- **WHEN** a guarded mutating operation is requested in interactive mode and no allowlist policy is configured for that operation
- **THEN** the system follows approval-gated policy flow and does not auto-deny solely due to missing allowlist

#### Scenario: Canonicalization failure denies operation
- **WHEN** target path canonicalization fails for any requested path
- **THEN** the system denies the operation and reports canonicalization-failure reason
