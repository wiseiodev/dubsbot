## ADDED Requirements

### Requirement: Bridge SHALL execute tools through a single pipeline
The system SHALL provide one execution entry point that accepts server id, tool name, and validated input payload, and returns a normalized execution envelope for both success and failure outcomes.

#### Scenario: Tool execution succeeds
- **WHEN** a caller executes a valid tool on a connected and authorized server
- **THEN** the system returns a success envelope containing correlation id, timing metadata, and structured tool output summary

### Requirement: Pipeline SHALL standardize execution errors
The system SHALL map invocation failures to stable error categories so callers can reliably handle retryable and non-retryable outcomes.

#### Scenario: Tool invocation fails in provider layer
- **WHEN** the MCP provider returns an execution failure
- **THEN** the system returns a `tool_failed` envelope with stable error fields and preserved correlation id
