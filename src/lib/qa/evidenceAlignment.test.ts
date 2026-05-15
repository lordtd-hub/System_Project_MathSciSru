import { describe, expect, it } from "vitest";
import { buildEvidenceContinuityIndicators } from "./evidenceAlignment";

describe("evidence alignment helpers", () => {
  it("marks proposal objectives and timeline as complete when available", () => {
    const indicators = buildEvidenceContinuityIndicators({
      proposalObjectives: "Develop and evaluate a prototype.",
      proposalTimelineItems: [{ activity: "Build prototype", startWeek: 1, endWeek: 8, deliverable: "Prototype" }]
    });
    expect(indicators.find((item) => item.key === "proposal_objectives")?.complete).toBe(true);
    expect(indicators.find((item) => item.key === "proposal_timeline")?.complete).toBe(true);
  });

  it("represents missing evidence as incomplete instead of hiding it", () => {
    const indicators = buildEvidenceContinuityIndicators({});
    expect(indicators.every((item) => item.complete === false)).toBe(true);
  });
});
