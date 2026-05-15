import { describe, expect, it } from "vitest";
import { totalAdvisorScore, validateAdvisorScore } from "./advisorScoring";

describe("Advisor scoring", () => {
  it("validates rubric ranges and computes total on a 100-point scale", () => {
    const input = {
      responsibility: 25,
      researchProcess: 25,
      problemSolving: 25,
      communication: 15,
      professionalism: 10
    };
    expect(validateAdvisorScore(input)).toEqual([]);
    expect(totalAdvisorScore(input)).toBe(100);
  });

  it("rejects out-of-range and non-integer values", () => {
    expect(
      validateAdvisorScore({
        responsibility: 26,
        researchProcess: 25,
        problemSolving: 25,
        communication: 15,
        professionalism: 10
      }).join("\n")
    ).toContain("ความรับผิดชอบและตรงต่อเวลา");
    expect(
      validateAdvisorScore({
        responsibility: 25,
        researchProcess: 12.5,
        problemSolving: 25,
        communication: 15,
        professionalism: 10
      }).join("\n")
    ).toContain("กระบวนการทำงานวิจัยและความเป็นอิสระ");
  });
});
