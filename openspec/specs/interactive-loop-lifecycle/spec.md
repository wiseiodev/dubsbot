# interactive-loop-lifecycle Specification

## Purpose
TBD - created by archiving change rich-interactive-cli-loop-ux. Update Purpose after archive.
## Requirements
### Requirement: Loop phase visibility
The system SHALL maintain and expose a canonical lifecycle phase for each interactive loop session and render the current phase in the TUI.

#### Scenario: Phase changes are visible during execution
- **WHEN** a loop session progresses from initialization to planning and execution
- **THEN** the TUI shows each current phase transition in order using canonical phase names

### Requirement: Lifecycle transition validity
The system SHALL enforce valid lifecycle transitions and reject invalid transitions with a visible error state.

#### Scenario: Planning can complete without execution when no action is required
- **WHEN** a loop session determines during `planning` that no execution step is required for the turn
- **THEN** the system allows transition to `completed` and records a normal completion event

#### Scenario: Invalid transition is blocked
- **WHEN** a transition request attempts to move from `completed` back to `executing` in the same session
- **THEN** the system rejects the transition and records an invalid transition error event

