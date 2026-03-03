import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useMemo, useRef, useState } from 'react';
import type { AgentOrchestrator } from '../agent/orchestrator';
import type { TraceStore } from '../observability/traces';
import type { ToolRegistry } from '../tools/registry';
import type { ToolInvocation, ToolResult } from '../tools/schemas';
import {
  type ApprovalOutcome,
  getPhaseDisplayName,
  InteractiveLoopLifecycle,
  type InteractiveLoopPhase,
  isSensitiveAction,
  type LoopCheckpoint,
  LoopCheckpointStore,
  resolveApprovalOutcome,
} from './interactive-loop';

type AppProps = {
  orchestrator: AgentOrchestrator;
  tools: ToolRegistry;
  traces: TraceStore;
};

type PendingApproval = {
  invocation: ToolInvocation;
  resolve: (outcome: ApprovalOutcome) => void;
};

type SlashCommand = {
  command: string;
  description: string;
};

const SESSION_ID = 'interactive-session';
const BASE_COMMANDS: SlashCommand[] = [
  { command: '/help', description: 'Show available slash commands' },
  { command: '/resume', description: 'Resume from the last interrupted checkpoint' },
  { command: '/exit', description: 'Exit interactive mode' },
  { command: '/quit', description: 'Exit interactive mode' },
];
const APPROVAL_COMMANDS: SlashCommand[] = [
  { command: '/approve', description: 'Approve and run the pending sensitive action' },
  { command: '/deny', description: 'Deny and skip the pending sensitive action' },
  { command: '/dismiss', description: 'Dismiss and skip the pending sensitive action' },
  { command: '/help', description: 'Show available slash commands' },
];

export function ChatApp({ orchestrator, tools, traces }: AppProps) {
  const [value, setValue] = useState('');
  const [output, setOutput] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<InteractiveLoopPhase>('initializing');
  const [phaseHistory, setPhaseHistory] = useState<InteractiveLoopPhase[]>(['initializing']);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [lastStatus, setLastStatus] = useState<string>('');
  const { exit } = useApp();

  const checkpointStore = useMemo(() => new LoopCheckpointStore(SESSION_ID), []);
  const createLifecycle = () =>
    new InteractiveLoopLifecycle(SESSION_ID, async (event) => {
      await traces.write({
        timestamp: event.timestamp,
        type: `interactive-loop.${event.type}`,
        sessionId: SESSION_ID,
        payload: event.payload,
      });
    });
  const lifecycleRef = useRef(createLifecycle());
  const availableCommands = pendingApproval ? APPROVAL_COMMANDS : BASE_COMMANDS;
  const slashMatches =
    value.trim().startsWith('/') && value.trim().length > 1
      ? availableCommands.filter((item) => item.command.startsWith(value.trim().toLowerCase()))
      : [];

  const applyPhase = (next: InteractiveLoopPhase): void => {
    setPhase(next);
    setPhaseHistory((previous) => [...previous, next]);
  };

  const transitionPhase = async (next: Parameters<InteractiveLoopLifecycle['transitionTo']>[0]) => {
    const ok = await lifecycleRef.current.transitionTo(next);
    applyPhase(lifecycleRef.current.getPhase());
    return ok;
  };

  const saveCheckpoint = async (checkpoint: LoopCheckpoint): Promise<void> => {
    await checkpointStore.save(checkpoint);
    await lifecycleRef.current.recordCheckpointSaved(checkpoint);
    setResumeAvailable(true);
  };

  const runExecutionFromCheckpoint = async (checkpoint: LoopCheckpoint): Promise<void> => {
    const completed = new Set<number>(checkpoint.completedToolIndexes);
    let assistantMessage = checkpoint.assistantMessage;

    if (!(await transitionPhase('executing'))) {
      setOutput('Error: invalid lifecycle transition while entering execution.');
      return;
    }

    for (let index = checkpoint.nextToolIndex; index < checkpoint.toolPlan.length; index += 1) {
      if (completed.has(index)) {
        continue;
      }

      if (await lifecycleRef.current.handleInterruptAtCheckpoint()) {
        applyPhase(lifecycleRef.current.getPhase());
        await saveCheckpoint({
          ...checkpoint,
          phase: lifecycleRef.current.getPhase(),
          nextToolIndex: index,
          completedToolIndexes: Array.from(completed).sort((a, b) => a - b),
        });
        setOutput('Execution interrupted at a safe checkpoint. Type /resume to continue.');
        return;
      }

      const invocation = checkpoint.toolPlan[index];
      const sensitive = isSensitiveAction(invocation);
      if (sensitive) {
        if (!(await transitionPhase('awaiting_approval'))) {
          setOutput('Error: invalid lifecycle transition while awaiting approval.');
          return;
        }

        await saveCheckpoint({
          ...checkpoint,
          phase: lifecycleRef.current.getPhase(),
          nextToolIndex: index,
          completedToolIndexes: Array.from(completed).sort((a, b) => a - b),
        });

        const approvalOutcome = await new Promise<ApprovalOutcome>((resolve) => {
          setPendingApproval({ invocation, resolve });
        });

        await lifecycleRef.current.recordApprovalDecision({
          invocation,
          outcome: approvalOutcome,
        });

        if (approvalOutcome !== 'approved') {
          assistantMessage += `\nSkipped ${invocation.tool} (${approvalOutcome}).`;
          if (!(await transitionPhase('executing'))) {
            setOutput('Error: invalid lifecycle transition after denied approval.');
            return;
          }
          continue;
        }

        if (!(await transitionPhase('executing'))) {
          setOutput('Error: invalid lifecycle transition while re-entering execution.');
          return;
        }
      }

      const result = await tools.invoke(invocation);
      assistantMessage += `\n${formatToolResult(result)}`;
      completed.add(index);

      if (sensitive) {
        await saveCheckpoint({
          ...checkpoint,
          phase: lifecycleRef.current.getPhase(),
          nextToolIndex: index + 1,
          completedToolIndexes: Array.from(completed).sort((a, b) => a - b),
        });
      }

      if (await lifecycleRef.current.handleInterruptAtCheckpoint()) {
        applyPhase(lifecycleRef.current.getPhase());
        await saveCheckpoint({
          ...checkpoint,
          phase: lifecycleRef.current.getPhase(),
          nextToolIndex: index + 1,
          completedToolIndexes: Array.from(completed).sort((a, b) => a - b),
        });
        setOutput('Execution interrupted at a safe checkpoint. Type /resume to continue.');
        return;
      }
    }

    await transitionPhase('completed');
    await checkpointStore.clear();
    setResumeAvailable(false);
    setOutput(assistantMessage.trim());
  };

  const runTurn = async (userMessage: string): Promise<void> => {
    setBusy(true);
    setLastStatus('');
    setPhase('initializing');
    setPhaseHistory(['initializing']);
    setResumeAvailable(false);
    await checkpointStore.clear();

    lifecycleRef.current = createLifecycle();

    try {
      const initialPhase = await lifecycleRef.current.mapLegacySignal('planning_started');
      await transitionPhase(initialPhase);

      const result = await orchestrator.runTurn({
        userMessage,
        sessionId: SESSION_ID,
        mode: 'interactive',
      });

      if (result.toolPlan.length === 0) {
        await transitionPhase('completed');
        setResumeAvailable(false);
        setOutput(result.assistantResponse.message);
        setValue('');
        return;
      }

      const checkpoint: LoopCheckpoint = {
        sessionId: SESSION_ID,
        phase: lifecycleRef.current.getPhase(),
        lastUserMessage: userMessage,
        assistantMessage: result.assistantResponse.message,
        toolPlan: result.toolPlan,
        nextToolIndex: 0,
        completedToolIndexes: [],
      };

      await runExecutionFromCheckpoint(checkpoint);
      setValue('');
    } catch (error) {
      await transitionPhase('failed');
      setOutput(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const resume = async (): Promise<void> => {
    const checkpoint = await checkpointStore.load();
    if (!checkpoint) {
      setOutput('No resumable checkpoint found.');
      return;
    }

    setBusy(true);
    setLastStatus('Resuming from durable checkpoint...');
    lifecycleRef.current = createLifecycle();
    lifecycleRef.current.hydratePhase('interrupted');
    setPhase('interrupted');
    setPhaseHistory(['interrupted']);

    await lifecycleRef.current.recordCheckpointRestored(checkpoint);

    try {
      await transitionPhase('resuming');
      await runExecutionFromCheckpoint(checkpoint);
    } catch (error) {
      await transitionPhase('failed');
      setOutput(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const input = value.trim();
    if (!input) {
      return;
    }

    if (input === '/help') {
      setOutput(formatHelpText(availableCommands));
      setValue('');
      return;
    }

    if (pendingApproval) {
      const decision = resolveApprovalOutcome(input);
      if (!decision) {
        setLastStatus('Approval expected. Enter /approve, /deny, or /dismiss.');
        return;
      }

      pendingApproval.resolve(decision);
      setPendingApproval(null);
      setValue('');
      return;
    }

    if (busy) {
      return;
    }

    if (input === '/exit' || input === '/quit') {
      exit();
      return;
    }

    if (input === '/resume') {
      await resume();
      setValue('');
      return;
    }

    await runTurn(input);
  };

  useInput((input, key) => {
    if (key.tab) {
      if (slashMatches.length > 0) {
        setValue(slashMatches[0].command);
      }
      return;
    }

    if (key.ctrl && input === 'c') {
      if (busy) {
        void lifecycleRef.current.requestInterrupt().catch(() => {
          // Ignore trace/write errors while processing Ctrl+C.
        });
        setLastStatus('Interrupt requested. Waiting for next safe checkpoint...');
        return;
      }

      exit();
    }
  });

  const phaseLabel = getPhaseDisplayName(phase);
  const latestTransitions = phaseHistory.slice(-5).map((entry) => getPhaseDisplayName(entry));

  return (
    <Box flexDirection='column'>
      <Text>
        Dubsbot interactive mode. Type /exit to quit, /resume to continue an interrupted turn.
      </Text>
      <Text color='cyan'>Phase: {phaseLabel}</Text>
      <Text color='gray'>Recent phases: {latestTransitions.join(' -> ')}</Text>
      {resumeAvailable ? <Text color='yellow'>Resume available from last checkpoint.</Text> : null}
      {pendingApproval ? (
        <Box flexDirection='column'>
          <Text color='yellow'>Approval required for sensitive action:</Text>
          <Text>
            {pendingApproval.invocation.tool} ({pendingApproval.invocation.sideEffect})
          </Text>
          <Text color='gray'>Enter /approve, /deny, or /dismiss</Text>
        </Box>
      ) : null}
      <Box>
        <Text color='cyan'>{'> '}</Text>
        <TextInput value={value} onChange={setValue} onSubmit={submit} />
      </Box>
      {slashMatches.length > 0 ? (
        <Text color='gray'>
          Suggestions: {slashMatches.map((item) => item.command).join(', ')} (Tab to autocomplete)
        </Text>
      ) : null}
      {busy ? <Text color='yellow'>Loop active...</Text> : null}
      {lastStatus ? <Text color='yellow'>{lastStatus}</Text> : null}
      {output ? <Text>{output}</Text> : null}
    </Box>
  );
}

function formatToolResult(result: ToolResult): string {
  if (result.ok) {
    return `Tool ${result.tool} succeeded: ${result.summary}`;
  }

  return `Tool ${result.tool} failed: ${result.summary}${result.stderr ? ` (${result.stderr.trim()})` : ''}`;
}

function formatHelpText(commands: SlashCommand[]): string {
  const lines = ['Available slash commands:'];
  for (const command of commands) {
    lines.push(`${command.command} - ${command.description}`);
  }
  return lines.join('\n');
}
