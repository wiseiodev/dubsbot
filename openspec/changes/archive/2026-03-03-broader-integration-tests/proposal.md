## Why

Our integration test surface currently under-covers critical orchestration paths where regressions are costly: command flows (`chat`, `plan`, `index`), automation execution, policy/approval branching, and long-running daemon or watcher loops. We need broader end-to-end coverage now to reduce silent breakage as runtime and agent behavior continue to evolve.

## What Changes

- Add broader integration test scenarios for command execution paths across `chat`, `plan`, and `index` flows.
- Add integration coverage for automation scheduling, event-driven hook execution, and execution behavior, including expected handoff and completion states.
- Add branch-coverage scenarios for policy and approval-gated decision paths to ensure correct behavior under restricted and allowed modes.
- Add loop lifecycle tests for daemon and watcher behavior, including startup, steady-state processing, and controlled termination.
- Define stable fixtures/harness helpers for these scenarios to keep tests deterministic and maintainable.

## Capabilities

### New Capabilities
- `broader-integration-test-coverage`: Expands integration test requirements to cover command paths, automation and hook paths, policy/approval branches, and daemon/watcher loop lifecycle behavior.

### Modified Capabilities
- None.

## Impact

- Affected areas: test harnesses, integration test suites, command orchestration paths, automation runtime paths, policy gating logic, and daemon/watcher runtime loops.
- No external API contract changes are expected.
- CI runtime may increase; test organization and fixture reuse should minimize overhead.
