# agents-runtime-actions Specification

## Purpose
TBD - created by archiving change agents-md-runtime-actions. Update Purpose after archive.
## Requirements
### Requirement: Runtime SHALL Register AGENTS Commands as Invokable Actions
The runtime SHALL load command entries from `AGENTS.md` and register each valid command as an invokable runtime action before agent execution begins.

#### Scenario: Commands available after config load
- **WHEN** a workspace contains `AGENTS.md` with one or more valid command entries
- **THEN** runtime action discovery includes each command entry by its declared name

#### Scenario: Missing AGENTS file
- **WHEN** no `AGENTS.md` file exists in the workspace
- **THEN** runtime action discovery proceeds without AGENTS command actions and without fatal error

### Requirement: Runtime SHALL Execute AGENTS Commands Through Policy-Gated Command Execution
The system SHALL route AGENTS command actions through the standard command execution path and SHALL evaluate policy/approval before running shell commands.

#### Scenario: Mutating command requires approval in interactive mode
- **WHEN** an AGENTS command action resolves to a mutating shell command and mode is interactive
- **THEN** the policy engine returns an approval-required decision before command execution

#### Scenario: Automation allowlist permits safe write
- **WHEN** an AGENTS command action resolves to a write command in automation mode and policy allowlist explicitly permits it
- **THEN** the command is executed without additional interactive approval

### Requirement: Runtime SHALL Produce Structured Results for AGENTS Command Actions
For every AGENTS command action execution attempt, the runtime SHALL produce structured result data including action name, resolved command, policy decision outcome, and execution summary.

#### Scenario: Successful execution emits structured summary
- **WHEN** an AGENTS command action executes successfully
- **THEN** trace/transcript records include the AGENTS command name, executed command string, and summarized stdout/stderr outcome

#### Scenario: Policy-blocked execution emits structured denial
- **WHEN** policy denies an AGENTS command action
- **THEN** trace/transcript records include denial reason and no command process is started

### Requirement: Runtime SHALL Handle Invalid or Unknown AGENTS Command References Deterministically
The runtime SHALL return a deterministic error when an AGENTS command action reference is unknown, malformed, or conflicts in ways that prevent safe execution.

#### Scenario: Unknown command name
- **WHEN** the agent requests execution of an AGENTS command name that is not registered
- **THEN** runtime returns a not-found error result with no shell execution

#### Scenario: Duplicate command names in AGENTS definition
- **WHEN** `AGENTS.md` defines duplicate command names
- **THEN** runtime applies documented resolution behavior consistently and emits a structured warning

