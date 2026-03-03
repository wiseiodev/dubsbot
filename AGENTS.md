# AGENTS

This file defines local agent commands and hooks used by Dubsbot.

## Commands
- test: pnpm test
- typecheck: pnpm typecheck
- lint: pnpm lint
- build: pnpm build
- checks: pnpm checks
- migrate: pnpm db:migrate
- chat: pnpm dev -- chat
- index: pnpm dev -- index .

## Hooks
- file-change: pnpm test
- git-head-change: pnpm typecheck

## Agent Policy

- Default mode is approval-gated for mutating/destructive actions.
- Prefer read-only exploration before proposing writes.
- Return structured responses that conform to schema contracts.
- Keep changes minimal and focused.

## Contribution Notes

- Use `pnpm` for dependency changes.
- Keep imports extensionless in TypeScript source.
- Enforce style via Biome (`single quotes`, `2-space indent`).
- Before considering any task complete, run `pnpm checks` and ensure it passes.
