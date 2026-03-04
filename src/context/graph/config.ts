export function isSymbolEnrichmentEnabled(): boolean {
  return process.env.DUBSBOT_ENABLE_SYMBOL_ENRICHMENT === '1';
}
