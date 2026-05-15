import { describe, expect, it } from "vitest";
import { isPresentationAssessmentComplete, requiredPresentationCommitteeTeacherIds } from "./presentationCompletion";

const committeeAssignments = [
  { teacherId: "advisor", role: "ADVISOR" as const, active: true },
  { teacherId: "head", role: "HEAD" as const, active: true },
  { teacherId: "member", role: "MEMBER" as const, active: true },
  { teacherId: "old-member", role: "MEMBER" as const, active: false }
];

describe("presentation completion", () => {
  it("requires active HEAD/MEMBER scores for presentation completion", () => {
    expect(requiredPresentationCommitteeTeacherIds(committeeAssignments)).toEqual(["head", "member"]);
    expect(
      isPresentationAssessmentComplete({
        roundStatus: "SCORING_OPEN",
        committeeAssignments,
        scoreSubmissions: [{ teacherId: "head", status: "SUBMITTED" }]
      })
    ).toBe(false);
    expect(
      isPresentationAssessmentComplete({
        roundStatus: "SCORING_OPEN",
        committeeAssignments,
        scoreSubmissions: [
          { teacherId: "head", status: "SUBMITTED" },
          { teacherId: "member", status: "SUBMITTED" }
        ]
      })
    ).toBe(true);
  });

  it("treats explicitly closed or released rounds as complete", () => {
    expect(
      isPresentationAssessmentComplete({
        roundStatus: "SCORING_CLOSED",
        committeeAssignments,
        scoreSubmissions: []
      })
    ).toBe(true);
    expect(
      isPresentationAssessmentComplete({
        roundStatus: "RELEASED",
        committeeAssignments: [],
        scoreSubmissions: []
      })
    ).toBe(true);
  });
});
