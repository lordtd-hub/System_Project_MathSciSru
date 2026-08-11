import { describe, expect, it } from "vitest";
import { RateLimitExceededError } from "@/lib/security/rateLimit";
import { ScorePersistenceConflict } from "./persistPresentationScore";
import { classifyExpectedScoreActionError } from "./scoreActionErrors";

describe("expected score action errors", () => {
  it("returns typed conflict, rate-limit, serialization, and lock-timeout results", () => {
    expect(classifyExpectedScoreActionError(new ScorePersistenceConflict("score_editing_closed"), "r1")).toMatchObject({
      status: "conflict",
      code: "score_editing_closed"
    });
    expect(classifyExpectedScoreActionError(new RateLimitExceededError(), "r2")).toMatchObject({
      status: "rate_limit",
      code: "teacher_score_rate_limited"
    });
    expect(classifyExpectedScoreActionError({ code: "P2034" }, "r3")).toMatchObject({
      status: "conflict",
      code: "score_concurrent_update"
    });
    expect(classifyExpectedScoreActionError({ code: "P2010", meta: { code: "55P03" } }, "r4")).toMatchObject({
      status: "conflict",
      code: "score_concurrent_update"
    });
  });

  it("leaves unexpected infrastructure errors for correlation-only logging", () => {
    expect(classifyExpectedScoreActionError(new Error("database unavailable"), "r5")).toBeNull();
  });
});
