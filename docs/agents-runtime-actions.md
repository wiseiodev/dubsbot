# AGENTS Runtime Actions

`AGENTS.md` command entries are now registered as invokable runtime tools.

## Command Registration

- Every command in `## Commands` is registered as `agents:<name>`.
- If no built-in tool already uses the same name, an unprefixed alias (`<name>`) is also registered.
- Duplicate command names in `AGENTS.md` are resolved deterministically: first definition wins and a warning is emitted.

## Resolution Rules

- `agents:<name>` always resolves to AGENTS command lookup.
- Unknown `agents:<name>` references return a deterministic not-found result with no shell execution.
- If `<name>` collides with an existing built-in tool, built-in lookup wins and AGENTS command remains available as `agents:<name>`.

## Execution and Policy

- AGENTS commands execute through the same command executor as `exec-command`.
- Side effects are classified from the resolved shell command (`read`, `write`, `destructive`, `network`).
- Policy checks run before process execution.
- Interactive mode requires approval for mutating commands.
- Automation mode preserves write allowlist behavior.

## Observability Payload

Tool results and runtime observability include structured fields:

- `actionName`
- `resolvedCommand`
- `policyOutcome`
- `executionSummary`
