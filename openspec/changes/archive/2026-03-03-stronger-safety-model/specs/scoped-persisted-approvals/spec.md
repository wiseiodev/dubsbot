## ADDED Requirements

### Requirement: Persisted approvals SHALL be scope-bound
The system SHALL persist approvals with explicit scope keys including principal identity, operation class, resource scope, and expiration metadata. A persisted approval MUST only be reusable when all scope keys match the current request.

#### Scenario: Approval is reused only within identical scope
- **WHEN** a request matches principal, operation class, resource scope, and approval validity window of a stored approval
- **THEN** the system reuses the persisted approval and marks the decision as approved without prompting

#### Scenario: Approval is rejected on scope mismatch
- **WHEN** a stored approval exists but any scope key differs from the current request
- **THEN** the system SHALL NOT reuse the approval and SHALL require a new policy decision

### Requirement: Persisted approvals SHALL expire and be revocable
The system SHALL enforce expiration on persisted approvals and MUST support explicit revocation by scope identifier.

#### Scenario: Expired approval is ignored
- **WHEN** a matching persisted approval has passed its expiration timestamp
- **THEN** the system treats the approval as invalid and requires a new decision

#### Scenario: Revoked approval is not reused
- **WHEN** an approval has been revoked for the matching scope
- **THEN** the system SHALL NOT apply it to subsequent requests
