import { describe, expect, it } from "vitest";
import { calculateProgressQaCriterionScore, progressQaRubric, progressQaRubricItems, validateProgressQaRubricTotalIs100 } from "./progressQaRubric";

describe("QA progress condition rubric", () => {
  it("has a 100-point total", () => {
    expect(validateProgressQaRubricTotalIs100()).toBe(true);
    expect(progressQaRubric.reduce((sum, section) => sum + section.maxScore, 0)).toBe(100);
  });

  it("calculates condition-based progress scores from mappings", () => {
    const relevantEvidence = progressQaRubric[0].criteria.find((criterion) => criterion.code === "A1");
    expect(relevantEvidence).toBeDefined();
    expect(calculateProgressQaCriterionScore(relevantEvidence!, 3)).toBe(15);
    expect(calculateProgressQaCriterionScore(relevantEvidence!, 2)).toBe(10);
    expect(calculateProgressQaCriterionScore(relevantEvidence!, 1)).toBe(5);
    expect(calculateProgressQaCriterionScore(relevantEvidence!, 0)).toBe(0);
  });

  it("maps to default persisted Progress rubric items", () => {
    const items = progressQaRubricItems();
    expect(items).toHaveLength(11);
    expect(items.reduce((sum, item) => sum + item.points, 0)).toBe(100);
    expect(items.map((item) => item.itemKey)).toEqual(["A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3", "D1", "D2"]);
  });
});
