## Context

`AGENTS.md` is already parsed into command and hook metadata, but only hooks are wired into executable runtime behavior in daemon flows. Command entries are not surfaced as invokable runtime actions, so users cannot trigger AGENTS-defined workflows through the same tool/action pipeline used by core features. This creates a mismatch with the v1 implementation plan goal that AGENTS.md custom commands operate as first-class runtime behavior.

Key constraints:
- Preserve default safety posture: mutating commands require approval unless explicitly allowed by policy.
- Reuse existing runtime primitives (tool execution, policy engine, traces) rather than introducing a parallel execution path.
- Keep AGENTS command parsing backwards-compatible with current markdown format.

## Goals / Non-Goals

**Goals:**
- Register AGENTS command entries into runtime action/tool discovery so they are invokable by name.
- Route AGENTS command execution through existing command execution + policy gates.
- Emit structured results/traces equivalent to built-in runtime actions.
- Define deterministic resolution and errors for unknown command names.

**Non-Goals:**
- Changing AGENTS markdown syntax beyond current command list format.
- Implementing remote command catalogs or workspace inheritance.
- Replacing existing hook triggers or changing their event semantics.

## Decisions

1. Introduce an AGENTS command action adapter in runtime tool registry.
- Decision: add a dynamic action registration step that maps `AgentsConfig.commands` to runtime action definitions.
- Rationale: keeps custom commands on the same execution substrate as built-in actions, minimizing special cases.
- Alternative considered: execute AGENTS commands directly in orchestrator bypassing registry. Rejected because it duplicates policy and observability logic.

2. Execute AGENTS commands through existing `exec-command` semantics with explicit metadata.
- Decision: wrap AGENTS commands as typed invocations that ultimately call the existing command executor.
- Rationale: preserves side-effect classification and approval controls with minimal new surface area.
- Alternative considered: create a new low-level shell executor specifically for AGENTS commands. Rejected to avoid drift in behavior and policy handling.

3. Apply command name namespace and deterministic lookup.
- Decision: use exact AGENTS command name matching and resolve collisions by local AGENTS order with clear warning/logging on duplicates.
- Rationale: preserves author intent from AGENTS while keeping execution predictable.
- Alternative considered: fuzzy matching or alias inference. Rejected due to ambiguity and safety risk.

4. Standardize runtime output shape for AGENTS command actions.
- Decision: include command name, resolved shell command, policy decision, and execution summary in trace payloads.
- Rationale: keeps auditability consistent across built-in and AGENTS-defined actions.
- Alternative considered: lightweight logging only. Rejected because it weakens replay/debug quality.

## Risks / Trade-offs

- [Risk] Duplicate command names in AGENTS cause ambiguous resolution. -> Mitigation: deterministic first-match behavior plus validation warning surfaced at load time.
- [Risk] Increased command surface area raises chance of accidental mutation attempts. -> Mitigation: continue enforcing approval/policy checks before execution.
- [Risk] Runtime startup may regress if command registration is overly coupled to I/O. -> Mitigation: keep parsing cached per workspace load and avoid repeated file reads per turn.
- [Risk] Inconsistent user expectations between hooks and commands. -> Mitigation: document execution model and keep hook behavior unchanged.

## Migration Plan

1. Extend runtime registry bootstrap to include AGENTS command action descriptors.
2. Add execution adapter and policy integration tests.
3. Add observability payload assertions for AGENTS command actions.
4. Update docs/help text to describe command invocation and safety behavior.
5. Rollback path: disable AGENTS command registration flag/path and retain parser-only behavior.

## Open Questions

- Should AGENTS command actions be exposed to users with a prefixed identifier (for example `agents:<name>`) or plain name only?
- Should duplicate command names fail fast, or remain warning-only for compatibility?
- Do we need per-command timeout overrides from AGENTS metadata in v1, or keep global executor defaults?
