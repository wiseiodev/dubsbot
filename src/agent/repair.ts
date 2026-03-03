export function buildRepairPrompt(input: {
  originalPrompt: string;
  errorMessage: string;
  attempt: number;
}): string {
  return [
    input.originalPrompt,
    '',
    'Previous response failed schema validation.',
    `Attempt: ${input.attempt}`,
    `Error: ${input.errorMessage}`,
    'Return ONLY a valid JSON object that strictly matches the schema.',
  ].join('\n');
}
