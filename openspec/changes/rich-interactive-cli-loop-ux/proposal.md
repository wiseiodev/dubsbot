## Why

The current CLI interaction flow lacks clear lifecycle visibility and dependable control during long-running loops, which makes it hard to trust or safely operate. Improving phase transparency, pause/resume behavior, and explicit in-TUI approvals will reduce operator mistakes and increase confidence in interactive workflows.

## What Changes

- Add explicit loop phase/lifecycle states in the TUI (for example: initializing, planning, awaiting-approval, executing, interrupted, resuming, completed, failed).
- Add interrupt handling that allows users to pause active loop execution safely and resume from the last durable checkpoint.
- Add explicit in-TUI approval prompts before mutating/destructive actions, with clear action summaries and confirmation outcomes.
- Add durable loop session state and event logging needed to restore context after interrupts or restarts.
- Add tests for lifecycle rendering, interrupt/resume transitions, and approval-gated execution behavior.

## Capabilities

### New Capabilities
- `interactive-loop-lifecycle`: Defines user-visible loop phases and lifecycle transitions in the TUI.
- `interactive-loop-interrupt-resume`: Defines how loop execution is interrupted, checkpointed, and resumed.
- `interactive-loop-approval-prompts`: Defines approval prompt behavior for high-impact actions within the TUI loop.

### Modified Capabilities
- None.

## Impact

- Affected systems: CLI/TUI event loop, execution orchestration, and state persistence.
- Affected code: phase/state models, renderer components, input handlers, action executor wrappers, and telemetry/logging.
- Potential API surface: internal event/state contracts for loop phases and approval events.
- Dependencies: no new external runtime dependency expected; test helpers/mocks may expand.
