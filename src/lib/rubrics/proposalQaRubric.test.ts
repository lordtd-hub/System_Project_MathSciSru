import { describe, expect, it } from "vitest";
import { calculateCriterionScore, calculateRubricTotal, proposalQaRubric, proposalQaRubricItems, validateRubricTotalIs100 } from "./proposalQaRubric";

describe("QA proposal condition rubric", () => {
  it("has a 100-point total", () => {
    expect(validateRubricTotalIs100()).toBe(true);
    expect(proposalQaRubric.reduce((sum, section) => sum + section.maxScore, 0)).toBe(100);
  });

  it("calculates condition-based scores from mappings", () => {
    const objectiveSpecificity = proposalQaRubric[0].criteria.find((criterion) => criterion.code === "A2");
    expect(objectiveSpecificity).toBeDefined();
    expect(calculateCriterionScore(objectiveSpecificity!, 3)).toBe(10);
    expect(calculateCriterionScore(objectiveSpecificity!, 2)).toBe(6);
    expect(calculateCriterionScore(objectiveSpecificity!, 1)).toBe(3);
    expect(calculateCriterionScore(objectiveSpecificity!, 0)).toBe(0);
  });

  it("calculates the rubric total from criterion scores without persistence", () => {
    expect(calculateRubricTotal({ A1: 5, A2: 10, A3: 5, B1: 15, B2: 10, B3: 5, B4: 10, C1: 10, C2: 10, D1: 10, D2: 10 })).toBe(100);
    expect(calculateRubricTotal({ A1: 5 })).toBe(5);
  });

  it("maps to the default persisted proposal rubric items", () => {
    const items = proposalQaRubricItems();
    expect(items).toHaveLength(11);
    expect(items.reduce((sum, item) => sum + item.points, 0)).toBe(100);
    expect(items.map((item) => item.itemKey)).toEqual(["A1", "A2", "A3", "B1", "B2", "B3", "B4", "C1", "C2", "D1", "D2"]);
    expect(items[0].itemLabelTh).toContain(" / ");
    expect(items[0].evidenceHint).toContain("ระบุปัญหา");
    expect(items[0].evidenceHint).toContain("Proposal identifies");
  });
});
