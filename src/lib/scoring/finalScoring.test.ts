import { describe, expect, it } from "vitest";
import { finalRawScoreMax, totalFinalNormalizedScore, totalFinalRawScore, validateFinalScore } from "./finalScoring";

describe("Final Presentation scoring", () => {
  it("validates rubric ranges and normalizes the 80-point raw rubric to 100", () => {
    const input = { researchResults: 30, executionProblemSolving: 20, presentation: 20, overall: 10 };
    expect(finalRawScoreMax).toBe(80);
    expect(validateFinalScore(input)).toEqual([]);
    expect(totalFinalRawScore(input)).toBe(80);
    expect(totalFinalNormalizedScore(input)).toBe(100);
  });

  it("rejects out-of-range and non-integer scores", () => {
    expect(validateFinalScore({ researchResults: 31, executionProblemSolving: 20, presentation: 20, overall: 10 }).join("\n")).toContain("Research/results");
    expect(validateFinalScore({ researchResults: 30, executionProblemSolving: 20.5, presentation: 20, overall: 10 }).join("\n")).toContain("Execution/problem-solving");
    expect(validateFinalScore({ researchResults: 30, executionProblemSolving: 20, presentation: 20, overall: -1 }).join("\n")).toContain("Overall");
  });
});
