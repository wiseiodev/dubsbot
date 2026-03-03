export type AgentRuntimeState = {
  sessionId: string;
  mode: 'interactive' | 'automation';
  turns: number;
  lastUserMessage: string;
};

export function createInitialState(input: {
  sessionId: string;
  mode: 'interactive' | 'automation';
  userMessage: string;
}): AgentRuntimeState {
  return {
    sessionId: input.sessionId,
    mode: input.mode,
    turns: 0,
    lastUserMessage: input.userMessage,
  };
}
