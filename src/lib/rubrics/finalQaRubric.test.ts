import { describe, expect, it } from "vitest";
import {
  calculateFinalQaCriterionScore,
  calculateFinalQaSectionSubtotals,
  finalQaRubric,
  findFinalQaCriterion,
  validateFinalQaRubricTotalIs100
} from "./finalQaRubric";

describe("final QA rubric", () => {
  it("has a total of 100 points", () => {
    expect(validateFinalQaRubricTotalIs100()).toBe(true);
  });

  it("maps condition counts to criterion scores", () => {
    const criterion = findFinalQaCriterion("A1");
    expect(criterion).toBeDefined();
    expect(calculateFinalQaCriterionScore(criterion!, 3)).toBe(15);
    expect(calculateFinalQaCriterionScore(criterion!, 2)).toBe(10);
    expect(calculateFinalQaCriterionScore(criterion!, 1)).toBe(5);
    expect(calculateFinalQaCriterionScore(criterion!, 0)).toBe(0);
  });

  it("handles report completeness by present required sections", () => {
    const criterion = findFinalQaCriterion("D1");
    expect(criterion).toBeDefined();
    expect(calculateFinalQaCriterionScore(criterion!, 7)).toBe(10);
    expect(calculateFinalQaCriterionScore(criterion!, 6)).toBe(8);
    expect(calculateFinalQaCriterionScore(criterion!, 5)).toBe(5);
    expect(calculateFinalQaCriterionScore(criterion!, 4)).toBe(0);
  });

  it("calculates section subtotals from criterion scores", () => {
    const subtotals = calculateFinalQaSectionSubtotals({ A1: 15, A2: 6, E1: 4, E2: 3 });
    expect(subtotals.find((section) => section.code === "A")?.score).toBe(21);
    expect(subtotals.find((section) => section.code === "E")?.score).toBe(7);
    expect(finalQaRubric).toHaveLength(5);
  });
});
