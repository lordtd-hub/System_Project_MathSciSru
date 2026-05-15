import { describe, expect, it } from "vitest";
import {
  classifyPlanTaskForRound,
  doesTaskOverlapWeekWindow,
  getProgressRoundWeekWindow,
  isQaProgressPlanCheckEnabled,
  normalizeProgressPlanTasks
} from "./progressPlanCheckConfig";

describe("QA progress plan check config", () => {
  it("enables only through the QA flag outside normal production", () => {
    expect(isQaProgressPlanCheckEnabled({})).toBe(false);
    expect(isQaProgressPlanCheckEnabled({ ENABLE_QA_PROGRESS_PLAN_CHECK: "1", NODE_ENV: "production", VERCEL_ENV: "production" })).toBe(false);
    expect(isQaProgressPlanCheckEnabled({ ENABLE_QA_PROGRESS_PLAN_CHECK: "1", NODE_ENV: "production", VERCEL_ENV: "preview" })).toBe(true);
    expect(isQaProgressPlanCheckEnabled({ ENABLE_QA_PROGRESS_PLAN_CHECK: "1", NODE_ENV: "development" })).toBe(true);
  });

  it("returns the expected progress week windows", () => {
    expect(getProgressRoundWeekWindow("PROGRESS_1")).toEqual({ startWeek: 1, endWeek: 8 });
    expect(getProgressRoundWeekWindow("PROGRESS_2")).toEqual({ startWeek: 9, endWeek: 16 });
    expect(getProgressRoundWeekWindow("PROPOSAL")).toBeNull();
  });

  it("detects overlap across round windows", () => {
    const window = { startWeek: 1, endWeek: 8 };
    expect(doesTaskOverlapWeekWindow({ activity: "Proof", startWeek: 6, endWeek: 10 }, window)).toBe(true);
    expect(doesTaskOverlapWeekWindow({ activity: "Final writeup", startWeek: 12, endWeek: 16 }, window)).toBe(false);
  });

  it("classifies plan tasks against a progress round", () => {
    const progress1 = { startWeek: 1, endWeek: 8 };
    expect(classifyPlanTaskForRound({ activity: "A", startWeek: 1, endWeek: 4 }, progress1)).toBe("due_in_this_round");
    expect(classifyPlanTaskForRound({ activity: "B", startWeek: 6, endWeek: 10 }, progress1)).toBe("ongoing_in_this_round");
    expect(classifyPlanTaskForRound({ activity: "C", startWeek: 9, endWeek: 12 }, progress1)).toBe("future_task");
    expect(classifyPlanTaskForRound({ activity: "D", startWeek: 1, endWeek: 4 }, { startWeek: 9, endWeek: 16 })).toBe("previous_task");
  });

  it("normalizes structured proposal timeline rows safely", () => {
    expect(normalizeProgressPlanTasks([{ activity: "Study", startWeek: "2", endWeek: "5", deliverable: "summary" }])).toEqual([
      { activity: "Study", startWeek: 2, endWeek: 5, deliverable: "summary" }
    ]);
  });
});
