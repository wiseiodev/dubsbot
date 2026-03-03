export type ConfigLayer = {
  source: string;
  values: Record<string, unknown>;
};

export function resolvePrecedence(layers: ConfigLayer[]): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const layer of layers) {
    Object.assign(resolved, layer.values);
  }
  return resolved;
}
