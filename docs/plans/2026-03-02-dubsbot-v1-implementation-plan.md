# Dubsbot v1 (Claude Code-Style, Model-Agnostic) Implementation Plan

> Updated on March 2, 2026 to reflect current implementation reality.

## Summary
Build a local-first coding agent CLI in `/Users/wise/dev/dubsbot` using Node + TypeScript + React/Ink, powered by Vercel AI SDK with provider-pluggable BYOK access (OpenAI, Anthropic, Google).
The system will use an agentic loop with strict Zod-validated object responses for **all** model turns (including final user responses), an optional local daemon for automations/indexing, and a PGLite-backed context service with relational + graph + vector + BM25/hybrid retrieval.

## Locked Product Decisions
- Scope: CLI + automation hooks (scheduled + event-driven).
- Runtime/stack: Node (not Bun), TypeScript, React/Ink, minimal Claude-like TUI.
- Compatibility: Conceptual parity with Claude Code (not command-for-command clone).
- Model routing: Vercel AI SDK adapters, env-var BYOK only.
- Safety: Approval-gated by default; automations can do safe writes via allowlist policies.
- Extensibility: MCP + custom commands + hooks in v1.
- Storage: PGLite from day one, graph-in-Postgres model.
- Context: Foundational graph+vector + relational history + hybrid retrieval (grep/find/BM25/vector).
- Indexing: Initial full index + incremental updates via file-watch/git events.
- Observability: local structured traces/transcripts + optional OpenTelemetry export.
- Platforms: macOS + Linux.
- Distribution target: global npm CLI (current implementation is runnable locally via `pnpm` scripts).
- Repo layout: single package first.

## Public Interfaces and Types
Create these core contracts first and treat them as stable internal APIs for v1:

- `ProviderAdapter`
  File: `/Users/wise/dev/dubsbot/src/providers/types.ts`
  Methods: `generateStructured`, `streamStructured`, `embed`, `countTokens`, `supports(model, capability)`.
  Implementation detail: adapters use `generateText`/`streamText` with `Output.object(...)` (AI SDK v6 pattern), not deprecated `generateObject`/`streamObject`.

- `AgentTurnEnvelope` (Zod schema)
  File: `/Users/wise/dev/dubsbot/src/agent/schemas/turn.ts`
  Fields: `turnType`, `intent`, `contextRequest`, `toolPlan`, `approvalRequest`, `assistantResponse`, `termination`.

- `ToolInvocation` + `ToolResult` (Zod schemas)
  File: `/Users/wise/dev/dubsbot/src/tools/schemas.ts`
  Fields: tool name, typed params, side-effect classification, execution policy tag, result payload, stderr/stdout summaries.

- `ApprovalPolicy` + `ApprovalDecision`
  File: `/Users/wise/dev/dubsbot/src/policy/schemas.ts`
  Fields: command/path allowlists, automation mode, mutation classification, decision reason.

- `AutomationSpec` + `HookSpec`
  File: `/Users/wise/dev/dubsbot/src/automation/schemas.ts`
  Fields: trigger type, schedule/event filter, task prompt, workspace scope, write permissions, retry strategy.

- `ContextQuery` + `ContextBundle`
  File: `/Users/wise/dev/dubsbot/src/context/schemas.ts`
  Fields: lexical query, vector query, graph traversal hints, rerank config, citations/provenance.

## Data Model (PGLite)
Create schema in `/Users/wise/dev/dubsbot/src/db/migrations/0001_init.sql` with:

- Relational tables: `sessions`, `messages`, `tool_runs`, `approvals`, `automations`, `hooks`, `indexes`, `files`, `chunks`.
- Graph tables: `context_nodes`, `context_edges`, `node_versions`, `edge_versions`.
- Vector/BM25 support tables: `chunk_embeddings`, `bm25_documents`, `bm25_terms` (or equivalent FTS strategy).
- Provenance tables: `context_bundle_items`, `retrieval_runs`.
- Unique and FK constraints for deterministic replay.
- Idempotent migration runner in `/Users/wise/dev/dubsbot/src/db/migrate.ts`, with CLI entrypoint in `/Users/wise/dev/dubsbot/src/db/migrate-cli.ts`.

## End-to-End Runtime Flow
1. TUI accepts user input or automation trigger.
2. Orchestrator assembles context request object.
3. Model call via provider adapter returns typed object only (`generateText`/`streamText` + `Output.object`).
4. Zod validates response.
5. On validation failure: retry with repair prompt up to 3 attempts, then fail safe with no side effects.
6. Tool plan executes through policy engine.
7. Mutating actions require approval (or explicit automation allowlist permit).
8. Results are persisted to PGLite and observability stream.
9. Loop repeats until termination object is emitted.

## Implementation Work Plan
1. Bootstrap project foundation.
2. Build strict schema layer first (Zod-first architecture).
3. Implement provider abstraction over AI SDK (OpenAI/Anthropic/Google).
4. Implement orchestrator with validation+repair loop.
5. Implement local tool execution + approval policy engine.
6. Implement PGLite persistence and migrations.
7. Implement context indexing and retrieval pipeline.
8. Implement optional daemon for automations/hooks/index workers.
9. Implement MCP integration + custom command/hook loader (`AGENTS.md`).
10. Implement observability and optional OpenTelemetry export.
11. Finalize CLI UX and command surface.

## Test Cases and Scenarios
- Schema enforcement:
  - Model returns malformed object; runtime retries repair and then hard-fails safely.
  - Final user response must match response schema.
- Provider adapters:
  - OpenAI/Anthropic/Google adapters pass conformance tests for structured generation and streaming.
  - Anthropic embeddings use deterministic local fallback in current implementation.
- Policy and approvals:
  - Mutating command blocked without approval.
  - Automation safe-write allowlist permits only explicit commands/paths.
- Context correctness:
  - Initial index creates chunk/node/edge/vector artifacts.
  - Incremental update reflects file edits, renames, deletes.
  - Hybrid retrieval returns combined lexical + vector + graph evidence.
- Daemon behavior:
  - Scheduler fires jobs on time.
  - Event hooks trigger on configured events.
  - Daemon off mode still supports manual CLI workflows.
- Observability:
  - Every agent turn/tool run has a persisted trace record.
  - OTel export can be toggled on/off without affecting local trace writes.
- End-to-end:
  - CLI commands (`chat`, `plan`, `index`, `automations`) execute through the local runtime.
  - Daemon mode runs scheduler and hook/watch loops.

## Acceptance Criteria
- A developer can run interactive sessions locally via `pnpm dev -- chat` (global npm install path is a target, not yet published).
- All model interactions are object-based and Zod-validated.
- Agent can read/edit/run tooling with approval gates and policy enforcement.
- Automations run via daemon with schedule + event triggers.
- Repo indexing and incremental updates keep context fresh.
- Hybrid retrieval demonstrably improves grounded responses.
- MCP/custom commands/hooks function from `AGENTS.md` configuration.
- Structured traces and transcripts are available locally; OTel export is optional.

## Assumptions and Defaults
- Node LTS baseline: Node 22+.
- Package manager/tooling: pnpm scripts, TypeScript build pipeline.
- Secrets: environment variables only for v1 (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, etc.).
- Default validation retry policy: 3 repair attempts, then fail-safe.
- Current provider note: Anthropic adapter embeddings are deterministic local fallback.
- Default OS support: macOS and Linux only in v1.
- No hosted backend in v1 (strictly local-first).
- Single-package repository for v1; internal module boundaries must be clean enough to split later.
