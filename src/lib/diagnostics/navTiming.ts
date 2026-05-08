type NavTimerOptions = {
  enabled?: boolean;
};

function timingEnabled(options?: NavTimerOptions) {
  return options?.enabled ?? process.env.NAV_TIMING_LOGS === "1";
}

function safeLabel(value: string) {
  return value.replace(/[^a-zA-Z0-9_.:/-]/g, "_").slice(0, 120);
}

export function createNavTimer(route: string, options?: NavTimerOptions) {
  const enabled = timingEnabled(options);
  const safeRoute = safeLabel(route);
  const start = performance.now();

  return {
    startBlock() {
      return performance.now();
    },
    endBlock(blockName: string, blockStart: number) {
      if (!enabled) return;
      const durationMs = Math.round(performance.now() - blockStart);
      console.info(`[nav-timing] route=${safeRoute} block=${safeLabel(blockName)} duration_ms=${durationMs}`);
    },
    async measure<T>(blockName: string, fn: () => Promise<T>): Promise<T> {
      if (!enabled) return fn();
      const blockStart = performance.now();
      try {
        return await fn();
      } finally {
        const durationMs = Math.round(performance.now() - blockStart);
        console.info(`[nav-timing] route=${safeRoute} block=${safeLabel(blockName)} duration_ms=${durationMs}`);
      }
    },
    end(result = "render_ready") {
      if (!enabled) return;
      const durationMs = Math.round(performance.now() - start);
      console.info(`[nav-timing] route=${safeRoute} result=${safeLabel(result)} total_ms=${durationMs}`);
    }
  };
}
