## 1. Integration Harness Foundations

- [x] 1.1 Add reusable integration fixture builders for workspace setup, policy mode, approval responses, and automation trigger state.
- [x] 1.2 Add deterministic loop-control helpers (bounded iterations/ticks and explicit termination hooks) for daemon/watcher tests.
- [x] 1.3 Document fixture usage conventions in integration test helpers to keep new scenarios consistent.

## 2. Command Flow Integration Coverage

- [x] 2.1 Add/expand `chat` integration scenarios for success path assertions and expected output state.
- [x] 2.2 Add/expand `plan` integration scenarios for policy-denied branch assertions and side-effect guards.
- [x] 2.3 Add/expand `index` integration scenarios for controlled recoverable failure behavior and non-hanging exits.

## 3. Automation Lifecycle Integration Coverage

- [x] 3.1 Add integration scenarios that validate automation trigger-to-execution handoff and successful completion lifecycle state.
- [x] 3.2 Add integration scenarios that validate automation runtime failure lifecycle reporting with observable error details.
- [x] 3.3 Add integration scenarios that validate event-driven hook trigger-to-execution behavior and observable success/failure outcomes.

## 4. Policy and Approval Branch Coverage

- [x] 4.1 Add approval-granted integration scenario(s) that verify branch continuation and expected actions.
- [x] 4.2 Add approval-denied integration scenario(s) that verify boundary stop behavior and denied outcomes.
- [x] 4.3 Add shared assertions to ensure denied/gated branches do not perform unauthorized side effects.

## 5. Daemon/Watcher Loop Lifecycle Coverage

- [x] 5.1 Add daemon loop integration scenarios for startup, bounded work processing, and clean exit.
- [x] 5.2 Add watcher loop integration scenarios for fatal error termination and deadlock-free shutdown.
- [x] 5.3 Add timeout/cleanup safeguards in loop-focused tests to prevent CI hangs.

## 6. Verification and Stability

- [x] 6.1 Run targeted integration suites for command, automation, hooks, policy, and loop domains and fix flakiness.
- [x] 6.2 Run full test/type/lint verification (`pnpm test`, `pnpm typecheck`, `pnpm lint`) and resolve regressions.
- [x] 6.3 Capture an integration coverage matrix summary in test comments/docs to clarify maintained branch expectations.
