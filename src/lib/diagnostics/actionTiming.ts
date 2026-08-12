type ActionTimerOptions = {
  enabled?: boolean;
  requestId?: string;
};

function timingEnabled(options?: ActionTimerOptions) {
  return options?.enabled ?? (process.env.NODE_ENV === "development" || process.env.ACTION_TIMING_LOGS === "1");
}

function safeLabel(value: string) {
  const withoutEmail = value.replace(/\b[^\s@]+@[^\s@]+\b/g, "redacted");
  return withoutEmail.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 80);
}

export function createActionTimer(actionName: string, options?: ActionTimerOptions) {
  const enabled = timingEnabled(options);
  const safeAction = safeLabel(actionName);
  const requestId = options?.requestId ? safeLabel(options.requestId) : undefined;
  const start = performance.now();

  function logTiming(event: "block" | "complete", fields: Record<string, string | number>) {
    console.info(JSON.stringify({ type: "action_timing", event, action: safeAction, requestId, ...fields }));
  }

  return {
    async measure<T>(blockName: string, fn: () => Promise<T>): Promise<T> {
      if (!enabled) return fn();
      const blockStart = performance.now();
      try {
        return await fn();
      } finally {
        const durationMs = Math.round(performance.now() - blockStart);
        logTiming("block", { block: safeLabel(blockName), durationMs });
      }
    },
    end(result = "complete") {
      if (!enabled) return;
      const durationMs = Math.round(performance.now() - start);
      logTiming("complete", { result: safeLabel(result), durationMs });
    }
  };
}
