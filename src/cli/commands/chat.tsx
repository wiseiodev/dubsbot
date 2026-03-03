import { render } from 'ink';
import { ChatApp } from '../app';
import { createRuntime } from '../runtime';

export async function runChatCommand(prompt?: string): Promise<void> {
  const runtime = await createRuntime();

  if (prompt) {
    const result = await runtime.orchestrator.runTurn({
      userMessage: prompt,
      sessionId: 'oneshot-session',
      mode: 'interactive',
    });

    await runtime.transcripts.write({
      timestamp: new Date().toISOString(),
      sessionId: 'oneshot-session',
      role: 'assistant',
      text: result.assistantResponse.message,
    });

    console.log(result.assistantResponse.message);
    return;
  }

  render(<ChatApp orchestrator={runtime.orchestrator} />);
}
