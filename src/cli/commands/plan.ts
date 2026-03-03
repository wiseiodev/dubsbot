import { createRuntime } from '../runtime';

export async function runPlanCommand(prompt: string): Promise<void> {
  const runtime = await createRuntime();

  const result = await runtime.orchestrator.runTurn({
    userMessage: `Plan mode request:\n${prompt}`,
    sessionId: 'plan-session',
    mode: 'interactive',
  });

  const body = ['<proposed_plan>', result.assistantResponse.message, '</proposed_plan>'].join('\n');
  console.log(body);
}
