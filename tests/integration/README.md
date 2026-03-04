# Integration Coverage Matrix

This matrix tracks maintained branch expectations for high-risk orchestration paths.

| Domain | Branch | Test file |
| --- | --- | --- |
| `chat` | Success output state | `tests/integration/commands.integration.test.ts` |
| `plan` | Policy-denied branch + side-effect guard | `tests/integration/commands.integration.test.ts` |
| `index` | Recoverable failure, non-hanging exit | `tests/integration/commands.integration.test.ts` |
| Automation scheduler | Trigger handoff + completion lifecycle | `tests/integration/automation-hooks.integration.test.ts` |
| Automation runtime | Failure lifecycle + error visibility | `tests/integration/automation-hooks.integration.test.ts` |
| Event hooks | Success/failure hook outcomes | `tests/integration/automation-hooks.integration.test.ts` |
| Approval policy | Granted branch continuation | `tests/integration/policy-approval.integration.test.ts` |
| Approval policy | Denied boundary stop | `tests/integration/policy-approval.integration.test.ts` |
| Daemon loop | Startup + bounded processing + clean exit | `tests/integration/loops.integration.test.ts` |
| Watcher loop | Fatal termination + deadlock-free shutdown | `tests/integration/loops.integration.test.ts` |
| Loop cleanup | Timeout safeguards | `tests/integration/loops.integration.test.ts` |
