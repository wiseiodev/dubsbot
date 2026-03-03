export type SessionMessage = {
  role: 'user' | 'assistant';
  text: string;
};

export type AgentRuntimeState = {
  sessionId: string;
  mode: 'interactive' | 'automation';
  turns: number;
  history: SessionMessage[];
};

export function createInitialState(input: {
  sessionId: string;
  mode: 'interactive' | 'automation';
}): AgentRuntimeState {
  return {
    sessionId: input.sessionId,
    mode: input.mode,
    turns: 0,
    history: [],
  };
}

export function appendTurnToState(
  state: AgentRuntimeState,
  input: {
    userMessage: string;
    assistantMessage: string;
  },
  maxHistory = 12
): AgentRuntimeState {
  const nextHistory: SessionMessage[] = [
    ...state.history,
    { role: 'user', text: input.userMessage },
    { role: 'assistant', text: input.assistantMessage },
  ];

  return {
    ...state,
    turns: state.turns + 1,
    history: nextHistory.slice(Math.max(0, nextHistory.length - maxHistory)),
  };
}
