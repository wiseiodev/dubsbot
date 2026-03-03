export type OTelSpanInput = {
  name: string;
  attributes?: Record<string, string | number | boolean>;
};

export class OptionalOtelExporter {
  private readonly enabled = process.env.DUBSBOT_OTEL_ENABLED === '1';

  async span(input: OTelSpanInput, fn: () => Promise<void>): Promise<void> {
    const start = Date.now();
    await fn();

    if (!this.enabled) {
      return;
    }

    const durationMs = Date.now() - start;
    const payload = {
      name: input.name,
      durationMs,
      attributes: input.attributes ?? {},
      timestamp: new Date().toISOString(),
    };

    if (process.env.DUBSBOT_OTEL_DEBUG === '1') {
      console.error('[otel]', JSON.stringify(payload));
    }
  }
}
