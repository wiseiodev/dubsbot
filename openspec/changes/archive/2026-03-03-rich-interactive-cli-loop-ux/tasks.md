## 1. Lifecycle State Model and TUI Visibility

- [x] 1.1 Define canonical interactive loop phase enum/state model and transition guards
- [x] 1.2 Implement lifecycle event emission from loop orchestration points
- [x] 1.3 Update TUI renderer to display current phase and transition updates consistently
- [x] 1.4 Add tests for valid/invalid lifecycle transitions and visible phase updates

## 2. Interrupt Handling and Resume Flow

- [x] 2.1 Implement interrupt capture that requests controlled transition to `interrupted`
- [x] 2.2 Add checkpoint persistence at safe boundaries before/after sensitive execution points
- [x] 2.3 Implement resume path that restores checkpoint and transitions through `resuming` to `executing`
- [x] 2.4 Add tests for interrupt timing, checkpoint restore correctness, and non-replay of completed steps

## 3. Approval-Gated Sensitive Actions

- [x] 3.1 Define sensitive-action classification and route such actions through a shared approval wrapper
- [x] 3.2 Implement in-TUI approval prompt with action summary and explicit accept/deny outcomes
- [x] 3.3 Enforce execution blocking on denied/dismissed approvals and log approval decisions
- [x] 3.4 Add tests covering approval accepted, denied, and dismissed behavior paths

## 4. Integration, Observability, and Rollout Safety

- [x] 4.1 Add append-only session event logging for lifecycle, interrupt, resume, and approval events
- [x] 4.2 Add adapter/mapping layer for legacy executor signals to new lifecycle model where needed
- [x] 4.3 Run full verification suite and adjust docs for interactive loop lifecycle/approval behavior
