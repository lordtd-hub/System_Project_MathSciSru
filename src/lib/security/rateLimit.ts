type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitState>();

export class RateLimitExceededError extends Error {
  readonly code = "RATE_LIMIT_EXCEEDED";

  constructor() {
    super("มีการส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่");
    this.name = "RateLimitExceededError";
  }
}

export const pilotRateLimits = {
  devLogin: { limit: 8, windowMs: 60_000 },
  importExport: { limit: 20, windowMs: 60_000 },
  workflowMutation: { limit: 30, windowMs: 60_000 },
  scoring: { limit: 40, windowMs: 60_000 }
} satisfies Record<string, RateLimitOptions>;

// Pilot/MVP guard: this is per server instance and best-effort, not a distributed quota.
export function checkRateLimit(key: string, options: RateLimitOptions, now = Date.now()): RateLimitResult {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.limit - 1, resetAt: now + options.windowMs };
  }

  if (current.count >= options.limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  return { allowed: true, remaining: options.limit - current.count, resetAt: current.resetAt };
}

export function assertRateLimit(key: string, options: RateLimitOptions): void {
  const result = checkRateLimit(key, options);
  if (!result.allowed) {
    throw new RateLimitExceededError();
  }
}

export function resetRateLimitForTests(): void {
  buckets.clear();
}
