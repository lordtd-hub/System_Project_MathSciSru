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

  it("does not treat course-wide closure/release as proof an individual student sat the exam", () => {
    expect(
      isPresentationAssessmentComplete({
        roundStatus: "SCORING_CLOSED",
        committeeAssignments,
        scoreSubmissions: []
      })
    ).toBe(false);
    expect(
      isPresentationAssessmentComplete({
        roundStatus: "RELEASED",
        committeeAssignments: [],
        scoreSubmissions: []
      })
    ).toBe(false);
    expect(isPresentationAssessmentComplete({ roundStatus: "SCORING_CLOSED", committeeAssignments, scoreSubmissions: [
      { teacherId: "head", status: "SUBMITTED" }, { teacherId: "member", status: "LOCKED" }
    ] })).toBe(true);
  });
});
