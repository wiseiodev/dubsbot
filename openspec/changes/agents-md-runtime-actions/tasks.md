## 1. Command Registration

- [ ] 1.1 Extend AGENTS config loading/validation to detect duplicate command names and emit deterministic warnings.
- [ ] 1.2 Add runtime registration logic that converts `AGENTS.md` command entries into invokable runtime action descriptors.
- [ ] 1.3 Define and implement command lookup/identifier resolution behavior (including unknown-command error responses).

## 2. Execution and Policy Integration

- [ ] 2.1 Implement an AGENTS command action adapter that executes through the existing command execution path.
- [ ] 2.2 Ensure AGENTS command actions classify side effects and invoke policy decisions before process execution.
- [ ] 2.3 Enforce interactive approval for mutating AGENTS commands and preserve automation allowlist behavior.

## 3. Observability and UX

- [ ] 3.1 Extend trace/transcript payloads to include AGENTS action name, resolved command, policy outcome, and execution summary.
- [ ] 3.2 Add consistent user-facing summaries for success, denial, and not-found outcomes of AGENTS command actions.
- [ ] 3.3 Document runtime command behavior and resolution rules in user/developer docs.

## 4. Verification

- [ ] 4.1 Add/update unit tests for AGENTS command parsing, duplicate-name handling, and registration.
- [ ] 4.2 Add runtime/policy tests for approval-required, allowlisted automation execution, and blocked execution scenarios.
- [ ] 4.3 Add observability/result-shape tests for successful execution, policy denial, and unknown command references.
- [ ] 4.4 Run `pnpm test`, `pnpm typecheck`, and `pnpm lint` to verify implementation stability.
