import { Box, Text, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { useState } from 'react';
import type { AgentOrchestrator } from '../agent/orchestrator';

type AppProps = {
  orchestrator: AgentOrchestrator;
};

export function ChatApp({ orchestrator }: AppProps) {
  const [value, setValue] = useState('');
  const [output, setOutput] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const { exit } = useApp();

  const submit = async () => {
    const input = value.trim();
    if (!input || busy) {
      return;
    }

    if (input === '/exit' || input === '/quit') {
      exit();
      return;
    }

    setBusy(true);
    try {
      const result = await orchestrator.runTurn({
        userMessage: input,
        sessionId: 'interactive-session',
        mode: 'interactive',
      });
      setOutput(result.assistantResponse.message);
      setValue('');
    } catch (error) {
      setOutput(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box flexDirection='column'>
      <Text>Dubsbot interactive mode. Type /exit to quit.</Text>
      <Box>
        <Text color='cyan'>{'> '}</Text>
        <TextInput value={value} onChange={setValue} onSubmit={submit} />
      </Box>
      {busy ? <Text color='yellow'>Thinking...</Text> : null}
      {output ? <Text>{output}</Text> : null}
    </Box>
  );
}
