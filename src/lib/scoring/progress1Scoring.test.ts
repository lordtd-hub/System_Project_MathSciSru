import { describe, expect, it } from "vitest";
import { totalProgress1Score, totalProgress2Score, validateProgress1Score, validateProgress2Score } from "./progress1Scoring";

describe("Progress 1 scoring", () => {
  it("validates rubric ranges and computes total", () => {
    const input = { progress: 30, problemSolving: 20, researchResults: 20, presentation: 20, overall: 10 };
    expect(validateProgress1Score(input)).toEqual([]);
    expect(totalProgress1Score(input)).toBe(100);
  });

  it("rejects out-of-range and non-integer scores", () => {
    expect(validateProgress1Score({ progress: 31, problemSolving: 20, researchResults: 20, presentation: 20, overall: 10 })).toContain("Progress ต้องอยู่ระหว่าง 0-30");
    expect(validateProgress1Score({ progress: 10.5, problemSolving: 20, researchResults: 20, presentation: 20, overall: 10 })).toContain("Progress ต้องเป็นจำนวนเต็ม");
    expect(validateProgress1Score({ progress: 30, problemSolving: -1, researchResults: 20, presentation: 20, overall: 10 })).toContain("Problem-solving ต้องอยู่ระหว่าง 0-20");
  });
});

describe("Progress 2 scoring", () => {
  it("uses the same rubric ranges and total as Progress 1", () => {
    const input = { progress: 30, problemSolving: 20, researchResults: 20, presentation: 20, overall: 10 };
    expect(validateProgress2Score(input)).toEqual([]);
    expect(totalProgress2Score(input)).toBe(100);
  });

  it("rejects invalid Progress 2 scores", () => {
    expect(validateProgress2Score({ progress: 30, problemSolving: 21, researchResults: 20, presentation: 20, overall: 10 }).join("\n")).toContain("Problem-solving");
    expect(validateProgress2Score({ progress: 30, problemSolving: 20, researchResults: 20, presentation: 20, overall: 11 }).join("\n")).toContain("Overall");
  });
});
