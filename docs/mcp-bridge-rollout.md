# MCP Bridge Contracts And Rollout Guide

This guide documents the MCP bridge contracts introduced for `discover`, `connect`, and `execute`, plus a safe rollout and rollback procedure.

## Bridge Contract

### Discover

- Operation: `discover()`
- Response shape:
  - `correlationId`: shared identifier for traceability
  - `servers[]`: normalized records sorted by `serverId`
    - `serverId`
    - `displayName`
    - `transport` (`stdio` | `http` | `sse` | `unknown`)
    - `availability` (`available` | `unavailable`)
    - optional `diagnostics` for unavailable servers

### Connect

- Operation: `connect(serverId, correlationId?)`
- Success:
  - `ok: true`
  - `state: connected`
  - `sessionId`
  - `reusedSession` (health-validated reuse only)
- Failure:
  - `ok: false`
  - `state: failed`
  - standardized error category (`validation`, `connection_failed`, `timeout`, `internal`, etc.)

### Execute

- Operation: `execute({ serverId, toolName, input, ... })`
- Behavior:
  - validates input
  - evaluates policy before invocation
  - denies with `policy_denied` without invoking provider when blocked
  - returns normalized execution envelope for both success/failure
- Envelope fields:
  - `ok`
  - `correlationId`
  - `serverId`, `toolName`
  - `policyDecision`
  - `error` (or `null`)
  - `timing` (`startedAt`, `endedAt`, `durationMs`)
  - `outputSummary` (bounded/redacted)

## Audit Event Schema

Each bridge operation emits append-only audit records:

- `operation`: `discover` | `connect` | `execute`
- `outcome`: `success` | `failure` | `denied`
- `correlationId`
- optional `serverId`, `toolName`
- optional policy snapshot (`allowed`, `requiresApproval`, `decision`, `reason`, `sideEffect`)
- optional standardized `error`
- `timing`: start/end/duration
- operation metadata with redacted summaries of request/response payloads where relevant

## MCP Server Configuration

Set `DUBSBOT_MCP_SERVERS_JSON` to a JSON array:

```json
[
  {
    "id": "local-tools",
    "displayName": "Local Tools",
    "transport": "stdio",
    "command": "node",
    "args": ["./scripts/mcp-server.js"],
    "cwd": "/workspace/project"
  }
]
```

Invalid configurations are skipped from active use and surfaced as `unavailable` discovery records with `misconfigured` diagnostics.

## Incremental Rollout

1. Configure one known-safe MCP server in `DUBSBOT_MCP_SERVERS_JSON`.
2. Run discovery and verify normalized server/diagnostic output.
3. Run connect/execute against low-risk tools and inspect `mcp.bridge.*` trace entries.
4. Expand server list gradually after confirming policy-denied flows and failure classification behavior in staging.
5. Promote to production once success, denied, and failure audit records are all observed.

## Rollback

1. Remove or empty `DUBSBOT_MCP_SERVERS_JSON`.
2. Restart the process so bridge discovery returns an empty server set.
3. Verify no new `mcp.bridge.execute` success events are emitted.
4. Restore config only after corrective fixes and staging verification.
