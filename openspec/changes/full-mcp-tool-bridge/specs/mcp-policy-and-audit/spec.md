## ADDED Requirements

### Requirement: Policy SHALL be enforced before MCP tool invocation
The system SHALL evaluate policy for every tool execution request before invoking the remote tool and SHALL block execution when policy denies access.

#### Scenario: Policy denies tool execution
- **WHEN** a caller attempts to execute a tool that is not permitted by policy
- **THEN** the system returns a `policy_denied` result and does not invoke the MCP tool

### Requirement: Bridge SHALL emit auditable execution records
The system SHALL emit append-only audit events for execution attempts, policy decisions, connection outcomes, and terminal tool results using a shared correlation identifier.

#### Scenario: Audit record is emitted for denied execution
- **WHEN** policy denies a tool execution request
- **THEN** the system writes an audit event containing request metadata, denial reason, and correlation id

### Requirement: Audit records SHALL include outcome timing metadata
The system SHALL capture start timestamp, end timestamp, and duration for execution attempts to support operational analysis and incident reconstruction.

#### Scenario: Successful execution includes timing
- **WHEN** a tool execution completes successfully
- **THEN** the emitted audit event includes start time, end time, and calculated duration fields
