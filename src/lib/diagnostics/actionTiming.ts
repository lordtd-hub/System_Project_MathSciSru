type ActionTimerOptions = {
  enabled?: boolean;
};

function timingEnabled(options?: ActionTimerOptions) {
  return options?.enabled ?? (process.env.NODE_ENV === "development" || process.env.ACTION_TIMING_LOGS === "1");
}

function safeLabel(value: string) {
  return value.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 80);
}

export function createActionTimer(actionName: string, options?: ActionTimerOptions) {
  const enabled = timingEnabled(options);
  const safeAction = safeLabel(actionName);
  const start = performance.now();

  return {
    async measure<T>(blockName: string, fn: () => Promise<T>): Promise<T> {
      if (!enabled) return fn();
      const blockStart = performance.now();
      try {
        return await fn();
      } finally {
        const durationMs = Math.round(performance.now() - blockStart);
        console.info(`[action-timing] action=${safeAction} block=${safeLabel(blockName)} duration_ms=${durationMs}`);
      }
    },
    end(result = "complete") {
      if (!enabled) return;
      const durationMs = Math.round(performance.now() - start);
      console.info(`[action-timing] action=${safeAction} result=${safeLabel(result)} total_ms=${durationMs}`);
    }
  };
}
