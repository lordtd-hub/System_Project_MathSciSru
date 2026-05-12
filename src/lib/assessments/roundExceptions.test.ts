import { describe, expect, it } from "vitest";
import {
  DEFAULT_LATE_ROUND_PENALTY_PERCENT,
  LATE_ROUND_EXCEPTION_TYPE,
  applyLatePenalty,
  hasOpenLateRoundException,
  requiresLateRoundPenalty
} from "./roundExceptions";

describe("round exception late penalty helpers", () => {
  it("applies the default 10 percent deduction to late-round scores", () => {
    expect(DEFAULT_LATE_ROUND_PENALTY_PERCENT).toBe(10);
    expect(applyLatePenalty(100)).toBe(90);
    expect(applyLatePenalty(87.5)).toBe(78.75);
  });

  it("detects open late exceptions as active and penalty-bearing", () => {
    const exceptions = [{ exceptionType: LATE_ROUND_EXCEPTION_TYPE, status: "OPEN" }];
    expect(hasOpenLateRoundException(exceptions)).toBe(true);
    expect(requiresLateRoundPenalty(exceptions)).toBe(true);
  });

  it("ignores resolved late exceptions for current unlock and penalty logic", () => {
    const exceptions = [{ exceptionType: LATE_ROUND_EXCEPTION_TYPE, status: "RESOLVED" }];
    expect(hasOpenLateRoundException(exceptions)).toBe(false);
    expect(requiresLateRoundPenalty(exceptions)).toBe(false);
  });
});
