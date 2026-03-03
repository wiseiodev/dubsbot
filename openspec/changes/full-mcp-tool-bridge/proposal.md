## Why

Dubsbot needs a complete MCP bridge so agents can reliably discover available MCP servers, establish usable connections, and execute tools with consistent policy enforcement and traceable audit records. This is needed now to unblock secure tool automation workflows and reduce ad hoc integration logic.

## What Changes

- Add a server discovery capability that enumerates configured/available MCP servers and their connection metadata.
- Add a connection lifecycle capability to validate and establish MCP server sessions with explicit health/error reporting.
- Add a tool execution pipeline that routes MCP tool calls through authorization policy checks before invocation.
- Add end-to-end audit logging for MCP tool execution attempts, outcomes, policy decisions, and timing metadata.
- Expose structured bridge interfaces so higher-level agent flows can consume discovery, connect, and execute operations consistently.

## Capabilities

### New Capabilities
- `mcp-server-discovery`: Discover and list MCP servers with normalized metadata, availability, and diagnostics.
- `mcp-server-connection`: Connect to MCP servers through a managed session lifecycle with explicit success/failure states.
- `mcp-tool-execution-pipeline`: Execute MCP tools via a policy-gated and audited bridge pipeline.
- `mcp-policy-and-audit`: Evaluate execution policy and emit durable audit events for every tool execution attempt.

### Modified Capabilities
- None.

## Impact

- Affected code: MCP integration layer, tool dispatch surface, policy enforcement module, and logging/audit subsystem.
- APIs: New internal bridge interfaces for discovery/connect/execute operations and associated response contracts.
- Dependencies: Existing MCP client stack and policy engine; may require minor logging backend schema additions for audit fields.
- Systems: Runtime command execution path for agent-triggered MCP tool usage.
