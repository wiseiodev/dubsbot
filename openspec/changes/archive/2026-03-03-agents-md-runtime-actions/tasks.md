## 1. Command Registration

- [x] 1.1 Extend AGENTS config loading/validation to detect duplicate command names and emit deterministic warnings.
- [x] 1.2 Add runtime registration logic that converts `AGENTS.md` command entries into invokable runtime action descriptors.
- [x] 1.3 Define and implement command lookup/identifier resolution behavior (including unknown-command error responses).

## 2. Execution and Policy Integration

- [x] 2.1 Implement an AGENTS command action adapter that executes through the existing command execution path.
- [x] 2.2 Ensure AGENTS command actions classify side effects and invoke policy decisions before process execution.
- [x] 2.3 Enforce interactive approval for mutating AGENTS commands and preserve automation allowlist behavior.

## 3. Observability and UX

- [x] 3.1 Extend trace/transcript payloads to include AGENTS action name, resolved command, policy outcome, and execution summary.
- [x] 3.2 Add consistent user-facing summaries for success, denial, and not-found outcomes of AGENTS command actions.
- [x] 3.3 Document runtime command behavior and resolution rules in user/developer docs.

## 4. Verification

- [x] 4.1 Add/update unit tests for AGENTS command parsing, duplicate-name handling, and registration.
- [x] 4.2 Add runtime/policy tests for approval-required, allowlisted automation execution, and blocked execution scenarios.
- [x] 4.3 Add observability/result-shape tests for successful execution, policy denial, and unknown command references.
- [x] 4.4 Run `pnpm test`, `pnpm typecheck`, and `pnpm lint` to verify implementation stability.
