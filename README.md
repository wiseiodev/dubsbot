# Dubsbot

Model-agnostic local coding agent CLI inspired by Claude Code, built with TypeScript and powered by Vercel AI SDK.

## Highlights

- Local-first agent loop (`gather -> reason -> act -> verify`)
- Structured outputs with strict Zod validation
- Provider adapters for OpenAI, Anthropic, and Google
- Approval-gated execution policy for safer command/tool actions
- PGLite-backed local persistence for sessions, tools, retrieval metadata, and context indexing
- Hybrid context retrieval (lexical + vector + graph-scored ranking)
- Optional daemon for automations and file/git watch re-indexing
- Extensible command/hook model via `AGENTS.md`

## Requirements

- Node.js 24+
- pnpm 10+

## Quick Start

```bash
pnpm install
pnpm db:migrate
pnpm build
```

## CLI Commands

```bash
pnpm dev -- chat
pnpm dev -- chat "summarize this repo"
pnpm dev -- plan "create a rollout plan for indexing"
pnpm dev -- index .
pnpm dev retrieval-proof --profile smoke
pnpm dev -- automations list
pnpm dev -- automations add --name "Hourly Check" --cron "0 * * * *" --prompt "summarize local status"
pnpm dev -- automations run
```

Run daemon:

```bash
pnpm dev:daemon
```

## Interactive Loop UX

- The interactive chat loop now exposes lifecycle phases in the TUI: `initializing`, `planning`, `awaiting_approval`, `executing`, `interrupted`, `resuming`, `completed`, `failed`.
- Press `Ctrl+C` during active execution to request a controlled interrupt. The loop stops at the next safe checkpoint and saves resumable state.
- Use `/resume` to continue an interrupted turn from the last durable checkpoint.
- Sensitive tool actions (`write` and `destructive`) require an explicit in-TUI decision:
  - `/approve` to execute
  - `/deny` to skip
  - `/dismiss` to skip

## Quality Commands

```bash
pnpm lint
pnpm lint:fix
pnpm typecheck
pnpm test
pnpm build
```

## Project Layout

- `src/cli` - Ink TUI and command entrypoints
- `src/agent` - orchestrator and turn schemas
- `src/providers` - AI SDK provider adapters
- `src/policy` - approval and safety policy logic
- `src/context` - indexing, retrieval, file/git watchers
- `src/db` - PGLite client and migrations
- `src/automation` - scheduler, hooks, automation runner
- `src/observability` - traces/transcripts and optional OTel
- `src/mcp` - MCP process client
- `tests` - unit/integration-facing tests for core behavior

## Configuration

Environment variables (BYOK):

- `DUBSBOT_PROVIDER` (`openai` | `anthropic` | `google`) - defaults to `google`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `DUBSBOT_OPENAI_MODEL`
- `DUBSBOT_ANTHROPIC_MODEL`
- `DUBSBOT_GOOGLE_MODEL` (defaults to `gemini-3.1-pro-preview`)
- `DUBSBOT_OTEL_ENABLED=1` to enable telemetry export hooks
- `DUBSBOT_EMBEDDING_STRATEGY_V2=1` to enable explicit embedding strategy resolution/fallback
- `DUBSBOT_EMBEDDING_STRATEGY_CONFIG_JSON` to provide explicit strategy config
- `DUBSBOT_EMBEDDING_PROVENANCE_LOG=1` to emit embedding provenance log lines

## Notes

- Anthropic embeddings currently fall back to deterministic local vectors.
- This project intentionally uses Biome only (no ESLint/Prettier).
- Retrieval proofing benchmark schema/workflow docs: `docs/retrieval-proofing-benchmark-schema.md` and `docs/retrieval-proofing.md`.
- Embedding strategy rollout guide: `docs/embedding-strategy-rollout.md`.
