## Context

The current integration suite does not fully exercise high-risk orchestration paths that combine command execution, policy gating, automation behavior, and long-running runtime loops. This leaves room for regressions where unit tests pass but real command/runtime behavior diverges in production-like execution.

The test expansion must remain deterministic in CI and local runs, avoid excessive runtime growth, and align with existing `pnpm test` workflows and harness patterns.

## Goals / Non-Goals

**Goals:**
- Expand integration coverage for `chat`, `plan`, and `index` command paths with realistic success and failure cases.
- Add explicit integration coverage for automations execution lifecycle and event-driven hook execution.
- Validate policy and approval branch behavior under both allowed and blocked conditions.
- Validate daemon/watcher loop lifecycle behavior (startup, processing loop, shutdown/error exit).
- Keep scenarios deterministic through reusable fixtures and bounded loop controls.

**Non-Goals:**
- Replacing or redesigning existing test runners.
- End-to-end cloud/system tests that require external networked infrastructure.
- Refactoring core runtime architecture beyond what is needed for testability hooks.

## Decisions

1. Scenario-matrix approach for integration coverage.
- Decision: Model new tests as a matrix by execution domain (`chat`, `plan`, `index`, `automations`, `hooks`, `policy`, `daemon/watcher`) and branch type (happy path, gated/denied path, runtime failure path).
- Rationale: Makes gaps visible and ensures balanced branch coverage.
- Alternative considered: Adding ad-hoc tests as regressions appear. Rejected due to uneven coverage and missed branches.

2. Deterministic harness controls for loops and approvals.
- Decision: Add bounded iteration/time controls and explicit approval/policy stubs in integration harnesses.
- Rationale: Prevents flaky or hanging loop tests and makes branch behavior reproducible.
- Alternative considered: Real-time waits and environment-driven approvals. Rejected due to flakiness and non-determinism.

3. Shared fixture builders for command and automation contexts.
- Decision: Build reusable fixtures for workspace state, policy mode, approval responses, and automation schedules.
- Rationale: Reduces duplication and keeps scenarios readable while enabling targeted branch setup.
- Alternative considered: Fully inline setup per test file. Rejected due to maintenance overhead and inconsistent setup semantics.

4. Explicit coverage of failure/termination semantics.
- Decision: Include assertions for process/loop termination, retry/stop boundaries, and surfaced error states.
- Rationale: Long-running paths are most likely to regress silently.
- Alternative considered: Test only success paths first. Rejected because risk profile is dominated by failure handling.

## Risks / Trade-offs

- [Risk] CI duration increases due to broader integration scenarios. → Mitigation: Keep fixtures lightweight, bound loop iterations, and parallelize test files where safe.
- [Risk] Loop tests can still become flaky if timing assumptions leak in. → Mitigation: Use deterministic tick/step controls and avoid wall-clock sleeps.
- [Risk] Over-mocking could reduce behavioral realism. → Mitigation: Stub only external edges; keep orchestration logic and branch selection real.
- [Risk] Policy/approval semantics may evolve quickly. → Mitigation: Centralize policy fixtures and update one place when rules change.

## Migration Plan

1. Introduce shared integration fixtures/harness helpers for policy, approvals, automation scheduling, and loop control.
2. Add or expand integration suites per domain matrix with deterministic assertions.
3. Tune and stabilize flaky cases in CI (timeouts, bounded loops, fixture cleanup).
4. Document coverage map in test files to aid future maintenance.

Rollback strategy: Revert newly added suites/helpers if instability is discovered, then reintroduce incrementally by domain.

## Open Questions

- Should CI run the full expanded integration matrix on every push, or split full coverage to scheduled/nightly runs?
- Do we need separate slow-test tagging for daemon/watcher loop scenarios?
