# interactive-loop-approval-prompts Specification

## Purpose
Define explicit approval requirements for sensitive interactive loop actions so mutating or destructive operations only run after clear in-TUI user confirmation.
## Requirements
### Requirement: Explicit approval for sensitive actions
The system SHALL require explicit in-TUI user approval before executing mutating or destructive actions.

#### Scenario: Approval accepted executes action
- **WHEN** a sensitive action is queued for execution and the user approves it in the prompt
- **THEN** the action executes and the approval decision is recorded in session events

### Requirement: Approval denial prevents execution
The system SHALL prevent execution of a sensitive action when approval is denied or dismissed.

#### Scenario: Approval denied skips action
- **WHEN** a sensitive action prompt is denied by the user
- **THEN** the action is skipped, the loop remains active, and a denial event is recorded
