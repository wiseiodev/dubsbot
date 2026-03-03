## Why

Embedding behavior is currently inconsistent across providers, which makes retrieval quality, cost behavior, and runtime fallback semantics unpredictable. We need explicit, provider-configurable embedding strategy and traceable provenance so Anthropic and non-Anthropic paths produce consistent, debuggable outcomes.

## What Changes

- Add explicit embedding strategy configuration that can be set per provider and selected at runtime.
- Define deterministic Anthropic embedding behavior with native-first execution and controlled fallback rules.
- Capture embedding provenance metadata (provider/model/strategy/fallback path) for indexing and retrieval operations.
- Standardize error and fallback handling so embedding parity expectations are enforced across providers.

## Capabilities

### New Capabilities
- `embedding-strategy-configuration`: Defines explicit provider-configurable embedding strategy selection and validation behavior.
- `anthropic-embedding-fallback-and-provenance`: Defines Anthropic native/fallback execution rules and required provenance metadata handling.

### Modified Capabilities
- None.

## Impact

- Affected systems: embedding pipeline, provider adapters, indexing flow, retrieval/query flow, and observability metadata.
- Affected APIs/config: embedding config surface and internal embedding result schema.
- Runtime impact: improved determinism and debuggability, with clearer fallback behavior and auditability.
