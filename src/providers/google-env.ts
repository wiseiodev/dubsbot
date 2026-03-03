export function getGoogleApiKey(): string | undefined {
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}
