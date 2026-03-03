## Why

`AGENTS.md` currently provides command definitions that are parsed for configuration, but runtime behavior treats hooks as executable and commands as passive metadata. This blocks parity with the v1 goal that AGENTS-defined commands should be usable as real runtime actions with the same policy, approval, and trace guarantees as built-in tools.

## What Changes

- Introduce runtime registration of `AGENTS.md` commands so they are invokable as explicit actions, not only parsed configuration.
- Add a command execution path that routes AGENTS command runs through policy evaluation, side-effect classification, and approval flow.
- Ensure AGENTS command execution emits structured tool/trace records and user-visible summaries consistent with other runtime actions.
- Define behavior for missing/invalid command names and command resolution precedence.
- Keep existing hook behavior intact while sharing execution safeguards with command actions where appropriate.

## Capabilities

### New Capabilities
- `agents-runtime-actions`: Execute `AGENTS.md` command entries as first-class runtime actions with policy gating, approval handling, and observability.

### Modified Capabilities
- None.

## Impact

- Affected code:
  - `src/config/agents-loader.ts`
  - `src/tools/registry.ts`
  - `src/tools/exec-command.ts`
  - `src/agent/orchestrator.ts`
  - `src/policy/*`
  - `src/observability/*`
  - CLI/daemon wiring where command actions are surfaced
- Tests:
  - `tests/agents-loader.test.ts`
  - new runtime/policy/observability tests for AGENTS command actions
- APIs/contracts:
  - Runtime action/tool surface will include AGENTS-defined command actions
  - No breaking external API changes expected; behavior is additive
