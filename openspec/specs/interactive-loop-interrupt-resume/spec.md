# interactive-loop-interrupt-resume Specification

## Purpose
Define safe interrupt and resume behavior for interactive loop sessions so users can pause at checkpoints and continue without corrupting state or replaying completed steps.
## Requirements
### Requirement: Controlled interrupt handling
The system SHALL treat user interrupts as controlled lifecycle transitions and preserve session integrity.

#### Scenario: Interrupt pauses at safe checkpoint
- **WHEN** a user triggers an interrupt during active loop execution
- **THEN** the system transitions the session to `interrupted` at the next safe checkpoint without leaving partial state

### Requirement: Resumable loop sessions
The system SHALL persist checkpoint state so an interrupted session can resume from the last durable checkpoint.

#### Scenario: Resume continues from checkpoint
- **WHEN** a user selects resume after an interrupted session
- **THEN** the system restores the saved checkpoint and transitions through `resuming` to `executing` without replaying completed steps
