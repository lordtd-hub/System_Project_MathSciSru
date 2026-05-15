import { AssessmentRoundType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { baselineRubricDefinitions } from "./rubricBaseline";

describe("baseline rubric definitions", () => {
  it("covers every presentation assessment round needed for pilot scoring", () => {
    expect(baselineRubricDefinitions.map((definition) => definition.roundType)).toEqual([
      AssessmentRoundType.PROPOSAL,
      AssessmentRoundType.PROGRESS_1,
      AssessmentRoundType.PROGRESS_2,
      AssessmentRoundType.FINAL_PRESENTATION
    ]);
  });

  it("keeps proposal and progress/final rubrics populated", () => {
    for (const definition of baselineRubricDefinitions) {
      expect(definition.items.length).toBeGreaterThan(0);
      expect(definition.items.reduce((sum, item) => sum + item.points, 0)).toBeGreaterThan(0);
    }
    expect(baselineRubricDefinitions.find((definition) => definition.roundType === AssessmentRoundType.PROPOSAL)?.items).toHaveLength(11);
    expect(baselineRubricDefinitions.find((definition) => definition.roundType === AssessmentRoundType.PROGRESS_1)?.items).toHaveLength(11);
    expect(baselineRubricDefinitions.find((definition) => definition.roundType === AssessmentRoundType.PROGRESS_2)?.items).toHaveLength(11);
    expect(baselineRubricDefinitions.find((definition) => definition.roundType === AssessmentRoundType.FINAL_PRESENTATION)?.items).toHaveLength(11);
  });
});
