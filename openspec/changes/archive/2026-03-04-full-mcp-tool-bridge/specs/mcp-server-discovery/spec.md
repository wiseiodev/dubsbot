## ADDED Requirements

### Requirement: Bridge SHALL list discoverable MCP servers
The system SHALL provide a discovery operation that returns all configured or reachable MCP servers as normalized records including server identifier, display name, transport type, and availability status.

#### Scenario: Discovery succeeds with configured servers
- **WHEN** a caller invokes bridge discovery with valid runtime configuration
- **THEN** the system returns a deterministic list of normalized server records ordered by stable server identifier

### Requirement: Discovery SHALL report diagnostics for unavailable servers
The system SHALL include diagnostic details for servers that cannot be reached or validated so callers can distinguish misconfiguration from temporary connectivity issues.

#### Scenario: One server is unavailable during discovery
- **WHEN** discovery encounters a server that fails validation or handshake
- **THEN** the returned record includes an unavailable status and machine-readable diagnostic metadata
