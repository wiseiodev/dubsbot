# anthropic-embedding-fallback-and-provenance Specification

## Purpose
Define expected Anthropic-primary embedding behavior, including native-first execution,
failure-category-gated fallback sequencing, and required provenance metadata for both successful
embedding results and terminal failures.
## Requirements
### Requirement: Anthropic Native-First Execution Policy
For strategies configured with Anthropic as primary, the system SHALL attempt Anthropic native embedding first and SHALL only consider fallback providers explicitly listed in that strategy.

#### Scenario: Anthropic primary succeeds
- **WHEN** a request resolves to a strategy with Anthropic as primary and Anthropic returns embeddings successfully
- **THEN** the system returns the Anthropic embedding result without invoking fallback providers

#### Scenario: Anthropic primary fails with non-fallbackable error
- **WHEN** Anthropic returns an error outside configured fallbackable categories
- **THEN** the system returns a terminal embedding error and MUST NOT invoke fallback providers

### Requirement: Controlled Anthropic Fallback Behavior
The system SHALL invoke fallback providers for Anthropic strategies only for configured fallbackable failure categories and in configured fallback order.

#### Scenario: Fallback is invoked in configured order
- **WHEN** Anthropic primary fails with a fallbackable error category and fallback providers are configured
- **THEN** the system attempts fallback providers sequentially in strategy order until one succeeds or all fail

#### Scenario: No fallback configured
- **WHEN** Anthropic primary fails with a fallbackable error category but no fallback providers are configured
- **THEN** the system returns a structured failure indicating no fallback path was available

### Requirement: Embedding Provenance Metadata
The system SHALL attach provenance metadata to every embedding result and terminal failure outcome, including strategy id, attempt provider/model path, and fallback usage state.

#### Scenario: Provenance is emitted on success
- **WHEN** any provider successfully returns embeddings
- **THEN** the result includes provenance fields for strategy id, resolved provider/model, attempt path, and whether fallback was used

#### Scenario: Provenance is emitted on terminal failure
- **WHEN** all attempts fail or fallback is disallowed
- **THEN** the error payload includes provenance fields for attempted providers/models, failure category, and terminal resolution reason
