#!/usr/bin/env node
import { createProgram } from './cli/commands';

async function main(): Promise<void> {
  const program = createProgram();
  await program.parseAsync(process.argv);
}

main().catch((error) => {
  if (error instanceof Error) {
    if (error.message.includes('Chat preflight failed.')) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error(`Error: ${error.stack ?? error.message}`);
    }
  } else {
    console.error(`Error: ${String(error)}`);
  }
  process.exit(1);
});
