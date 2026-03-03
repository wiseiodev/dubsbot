## Context

The CLI currently executes work in a loop where internal progress and control points are not consistently visible in the TUI. Operators cannot reliably distinguish between phases, interruption semantics are unclear, and high-impact actions can feel implicit rather than explicitly confirmed in context. This change introduces a stateful interaction model that makes lifecycle transitions visible, interruption/resume deterministic, and approvals explicit before sensitive actions.

Constraints include preserving existing command semantics, minimizing disruption to non-interactive execution paths, and keeping behavior testable through deterministic state transitions.

## Goals / Non-Goals

**Goals:**
- Introduce a canonical loop lifecycle state model and render it consistently in the TUI.
- Support safe interrupt handling with resumable execution from durable checkpoints.
- Require explicit in-TUI approvals for mutating/destructive actions with clear summaries.
- Preserve deterministic behavior suitable for automated tests and replay/debug flows.

**Non-Goals:**
- Replacing the full command execution engine or redesigning all CLI screens.
- Introducing multi-user/session collaboration features.
- Defining long-term analytics dashboards beyond basic event logging needed for resume/debug.

## Decisions

1. Canonical lifecycle state machine
- Decision: model loop execution as explicit phases (`initializing`, `planning`, `awaiting_approval`, `executing`, `interrupted`, `resuming`, `completed`, `failed`).
- Rationale: a single source of truth simplifies rendering, control handling, and tests.
- Alternative considered: inferred phase from scattered flags/callbacks; rejected because phase drift is likely and hard to test.

2. Durable checkpoint + append-only event log for resume
- Decision: persist loop session checkpoints at safe boundaries (before/after approval and execution steps) and append lifecycle/approval events.
- Rationale: resume behavior needs explicit recovery points and auditable transition history.
- Alternative considered: in-memory resume only; rejected because process restarts and unexpected exits lose context.

3. Interrupt as state transition, not process abort
- Decision: map interrupt input (for example `Ctrl+C`) to a controlled transition into `interrupted` where current action completes or safely aborts at a checkpoint, then expose resume/exit options.
- Rationale: avoids partial mutation and gives users predictable control.
- Alternative considered: immediate hard stop; rejected due to risk of partial side effects.

4. Approval gate wrapper for sensitive actions
- Decision: all mutating/destructive actions pass through an approval wrapper that renders summary details and waits for explicit accept/deny.
- Rationale: centralizing approval policy prevents bypasses and keeps UX consistent.
- Alternative considered: action-specific ad hoc prompts; rejected due to inconsistent behavior and coverage gaps.

## Risks / Trade-offs

- [State model mismatch with existing executor assumptions] -> Mitigation: add adapter layer that maps old signals into new phase events during rollout.
- [Resume logic complexity causes edge-case regressions] -> Mitigation: checkpoint only at well-defined safe points and add transition matrix tests.
- [Approval prompts increase interaction latency] -> Mitigation: gate only high-impact actions and provide concise summaries to reduce friction.
- [Interrupt timing races around active actions] -> Mitigation: enforce serialized transition handling and explicit "interrupt pending" flag until checkpoint boundary.
