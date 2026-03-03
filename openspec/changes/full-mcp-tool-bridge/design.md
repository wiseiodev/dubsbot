## Context

Dubsbot currently lacks a unified bridge for MCP workflows, so discovery, connection, policy enforcement, and execution auditing are either missing or fragmented. This change introduces a single bridge layer that all MCP tool traffic passes through, providing normalized contracts and reliable observability. The system must keep existing agent flows stable while adding enforceable security controls and operational traceability.

## Goals / Non-Goals

**Goals:**
- Provide a single bridge API for MCP server discovery, connection lifecycle, and tool execution.
- Enforce policy checks before any MCP tool invocation.
- Emit structured audit records for all execution attempts and outcomes.
- Return deterministic, typed responses for success and failure paths.
- Make bridge behavior testable via scenario-oriented specs and implementation tasks.

**Non-Goals:**
- Replacing the underlying MCP protocol/client library.
- Building a UI for MCP operations.
- Designing a new external authorization system; this uses existing local policy machinery.
- Defining long-term analytics dashboards beyond required audit event emission.

## Decisions

1. Introduce an `McpBridge` service boundary with three explicit operations: `discover()`, `connect(serverId)`, and `execute(request)`.
Rationale: keeps orchestration centralized and removes ad hoc call sites.
Alternative considered: direct MCP client use from callers. Rejected due to inconsistent security and logging.

2. Add a policy gate as a required pre-execution step in `execute()`.
Rationale: policy decisions must be guaranteed before tool invocation to prevent bypasses.
Alternative considered: optional policy checks at call sites. Rejected because enforcement becomes non-uniform.

3. Use a normalized `ExecutionEnvelope` for all tool runs.
Envelope fields include request metadata, policy decision, invocation timing, output summary, and error classification.
Rationale: one shape simplifies caller behavior, testing, and audit ingestion.
Alternative considered: operation-specific response shapes. Rejected because it complicates downstream processing.

4. Emit append-only audit events with correlation IDs across discover/connect/execute flows.
Rationale: consistent correlation enables incident reconstruction and debugging.
Alternative considered: logging only terminal execution outcomes. Rejected because policy denials and connection failures must also be auditable.

5. Standardize bridge errors into categories (`validation`, `policy_denied`, `connection_failed`, `tool_failed`, `timeout`, `internal`).
Rationale: callers need reliable programmatic handling.
Alternative considered: raw provider errors. Rejected due to unstable contracts.

## Risks / Trade-offs

- [Overhead from policy and audit on every call] -> Mitigation: keep policy inputs minimal, log asynchronously where safe, and include latency budgets in tests.
- [Audit data growth] -> Mitigation: define bounded payload fields and avoid large raw output blobs by default.
- [Connection state drift for unstable servers] -> Mitigation: validate health on connect and before execute; classify stale-session failures explicitly.
- [Tighter contracts may break permissive callers] -> Mitigation: provide compatibility adapters during migration and document required fields.

## Migration Plan

1. Implement bridge interfaces and internal adapters to existing MCP client and policy services.
2. Route current MCP call paths through the bridge behind a feature flag or incremental rollout toggle.
3. Enable audit event emission and validate event schema in staging.
4. Switch default execution path to bridge and remove bypass paths.
5. Keep rollback path by toggling bridge routing off while preserving non-destructive schema additions.

## Open Questions

- Should discovery include passive connectivity probes, or only configured metadata with last-known status?
- What retention period and destination should be enforced for audit events in this repository’s deployment environments?
- Do we need per-tool policy overrides now, or can policy remain server-level in this phase?
