## ADDED Requirements

### Requirement: Command Flow Integration Coverage
The test suite MUST include integration scenarios that exercise `chat`, `plan`, and `index` command flows through their real orchestration paths, including success and failure branches.

#### Scenario: Chat command success path
- **WHEN** the integration suite executes `chat` with valid inputs and allowed policy
- **THEN** the command flow SHALL complete successfully and emit the expected terminal/output state

#### Scenario: Plan command policy-denied path
- **WHEN** the integration suite executes `plan` in a policy configuration that denies the action
- **THEN** the command flow SHALL terminate with a policy-denied result and no unauthorized side effects

#### Scenario: Index command recoverable failure path
- **WHEN** the integration suite executes `index` and encounters a controlled recoverable error in processing
- **THEN** the command flow SHALL surface the failure state according to runtime policy and exit without hanging

### Requirement: Automation Lifecycle Integration Coverage
The test suite MUST include integration scenarios for automation lifecycle behavior, including schedule trigger, event-driven hook trigger, execution handoff, and completion/failure signaling.

#### Scenario: Scheduled automation execution
- **WHEN** an automation trigger condition is satisfied in integration runtime
- **THEN** the automation SHALL start, execute, and report completion in the expected lifecycle state

#### Scenario: Event-driven hook execution
- **WHEN** a configured hook event is emitted in integration runtime
- **THEN** the hook pipeline SHALL trigger the configured action and report expected lifecycle state and outcome

#### Scenario: Automation execution failure reporting
- **WHEN** automation execution encounters a runtime failure
- **THEN** the automation SHALL report a failure lifecycle state with observable error details

### Requirement: Policy and Approval Branch Coverage
The test suite MUST verify integration behavior across policy and approval branches, including approved, denied, and gated flows.

#### Scenario: Approval granted branch
- **WHEN** a command requiring approval receives an approval response
- **THEN** the integration flow SHALL continue through the approved branch and complete expected actions

#### Scenario: Approval denied branch
- **WHEN** a command requiring approval receives a denial response
- **THEN** the integration flow SHALL stop at the approval boundary and emit a denied outcome

### Requirement: Daemon and Watcher Loop Lifecycle Coverage
The test suite MUST verify daemon and watcher loop lifecycle behavior, including startup, bounded processing, and controlled termination.

#### Scenario: Daemon loop bounded processing
- **WHEN** the daemon loop is started in integration tests with bounded iteration controls
- **THEN** it SHALL process expected work units and exit cleanly at the configured bound

#### Scenario: Watcher termination on fatal loop error
- **WHEN** the watcher loop encounters a configured fatal error condition
- **THEN** it SHALL terminate the loop and expose the fatal error outcome without deadlock
