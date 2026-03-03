import { render } from 'ink';
import { detectProvider, getProviderPreflightError } from '../../providers';
import { ChatApp } from '../app';
import { createRuntime } from '../runtime';

export async function runChatCommand(prompt?: string): Promise<void> {
  const provider = detectProvider();
  const preflightError = getProviderPreflightError(provider);
  if (preflightError) {
    throw new Error(
      [
        'Chat preflight failed.',
        preflightError,
        '',
        'Quick setup:',
        '  export DUBSBOT_PROVIDER=google',
        '  export GOOGLE_GENERATIVE_AI_API_KEY=your_key_here',
        '  # optional: export DUBSBOT_GOOGLE_MODEL=gemini-3.1-pro-preview',
        '',
        'Other providers:',
        '  export DUBSBOT_PROVIDER=openai && export OPENAI_API_KEY=your_key_here',
        '  export DUBSBOT_PROVIDER=anthropic && export ANTHROPIC_API_KEY=your_key_here',
      ].join('\n')
    );
  }

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

  render(
    <ChatApp orchestrator={runtime.orchestrator} tools={runtime.tools} traces={runtime.traces} />
  );
}
