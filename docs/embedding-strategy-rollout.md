# Embedding Strategy V2 Rollout

This rollout gates the explicit embedding strategy engine behind:

- `DUBSBOT_EMBEDDING_STRATEGY_V2=1`

Optional config override:

- `DUBSBOT_EMBEDDING_STRATEGY_CONFIG_JSON` (JSON string matching schema version `1.0`)

Optional provenance logging:

- `DUBSBOT_EMBEDDING_PROVENANCE_LOG=1`

## Enable (staged)

1. Set `DUBSBOT_EMBEDDING_STRATEGY_V2=1` in a non-production environment.
2. Start with default legacy-mapped config (no custom JSON).
3. Run indexing and retrieval checks.
4. If needed, provide explicit strategy JSON to control Anthropic fallback paths.
5. Verify fallback/provenance behavior with tests:
   - `pnpm test -- embedding-strategy`

## Rollback

1. Unset or set `DUBSBOT_EMBEDDING_STRATEGY_V2=0`.
2. Restart CLI/daemon processes.
3. System returns to legacy embedding execution path.

Rollback is safe because provenance fields are additive and read-compatible.

