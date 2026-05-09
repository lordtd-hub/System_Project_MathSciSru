import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitForTests } from "./rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimitForTests());

  it("allows normal use under the threshold", () => {
    const options = { limit: 2, windowMs: 60_000 };

    expect(checkRateLimit("user-1", options, 1_000).allowed).toBe(true);
    expect(checkRateLimit("user-1", options, 2_000).allowed).toBe(true);
  });

  it("blocks after the threshold until the window resets", () => {
    const options = { limit: 1, windowMs: 60_000 };

    expect(checkRateLimit("user-1", options, 1_000).allowed).toBe(true);
    expect(checkRateLimit("user-1", options, 2_000).allowed).toBe(false);
    expect(checkRateLimit("user-1", options, 61_001).allowed).toBe(true);
  });
});
