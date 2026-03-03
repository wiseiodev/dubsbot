## 1. Integration Harness Foundations

- [ ] 1.1 Add reusable integration fixture builders for workspace setup, policy mode, approval responses, and automation trigger state.
- [ ] 1.2 Add deterministic loop-control helpers (bounded iterations/ticks and explicit termination hooks) for daemon/watcher tests.
- [ ] 1.3 Document fixture usage conventions in integration test helpers to keep new scenarios consistent.

## 2. Command Flow Integration Coverage

- [ ] 2.1 Add/expand `chat` integration scenarios for success path assertions and expected output state.
- [ ] 2.2 Add/expand `plan` integration scenarios for policy-denied branch assertions and side-effect guards.
- [ ] 2.3 Add/expand `index` integration scenarios for controlled recoverable failure behavior and non-hanging exits.

## 3. Automation Lifecycle Integration Coverage

- [ ] 3.1 Add integration scenarios that validate automation trigger-to-execution handoff and successful completion lifecycle state.
- [ ] 3.2 Add integration scenarios that validate automation runtime failure lifecycle reporting with observable error details.
- [ ] 3.3 Add integration scenarios that validate event-driven hook trigger-to-execution behavior and observable success/failure outcomes.

## 4. Policy and Approval Branch Coverage

- [ ] 4.1 Add approval-granted integration scenario(s) that verify branch continuation and expected actions.
- [ ] 4.2 Add approval-denied integration scenario(s) that verify boundary stop behavior and denied outcomes.
- [ ] 4.3 Add shared assertions to ensure denied/gated branches do not perform unauthorized side effects.

## 5. Daemon/Watcher Loop Lifecycle Coverage

- [ ] 5.1 Add daemon loop integration scenarios for startup, bounded work processing, and clean exit.
- [ ] 5.2 Add watcher loop integration scenarios for fatal error termination and deadlock-free shutdown.
- [ ] 5.3 Add timeout/cleanup safeguards in loop-focused tests to prevent CI hangs.

## 6. Verification and Stability

- [ ] 6.1 Run targeted integration suites for command, automation, hooks, policy, and loop domains and fix flakiness.
- [ ] 6.2 Run full test/type/lint verification (`pnpm test`, `pnpm typecheck`, `pnpm lint`) and resolve regressions.
- [ ] 6.3 Capture an integration coverage matrix summary in test comments/docs to clarify maintained branch expectations.
