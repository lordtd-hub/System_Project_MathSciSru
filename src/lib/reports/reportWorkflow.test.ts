import { describe, expect, it } from "vitest";
import {
  allRequiredReportReviewersPassed,
  getReportSubmissionGate,
  isAssignedReportReviewer,
  latestReportVersionHasRevisionRequest,
  requiredReportReviewerIds
} from "./reportWorkflow";

describe("report workflow gates", () => {
  it("allows the first report submission after Final is done or final presentation is completed", () => {
    expect(getReportSubmissionGate({ projectStatus: "FINAL_DONE", latestReportHasRevisionRequest: false })).toEqual({
      allowed: true,
      reason: null
    });
    expect(
      getReportSubmissionGate({
        projectStatus: "IN_PROGRESS",
        latestReportHasRevisionRequest: false,
        finalPresentationCompleted: true
      })
    ).toEqual({
      allowed: true,
      reason: null
    });
    expect(getReportSubmissionGate({ projectStatus: "IN_PROGRESS", latestReportHasRevisionRequest: false })).toEqual({
      allowed: false,
      reason: "NOT_FINAL_DONE"
    });
  });

  it("allows resubmission only after a reviewer requests revision", () => {
    expect(getReportSubmissionGate({ projectStatus: "REPORT_REVIEW", latestReportHasRevisionRequest: true }).allowed).toBe(true);
    expect(getReportSubmissionGate({ projectStatus: "REPORT_REVIEW", latestReportHasRevisionRequest: false })).toEqual({
      allowed: false,
      reason: "UNDER_REVIEW"
    });
  });

  it("blocks resubmission after report approval or completion states", () => {
    expect(getReportSubmissionGate({ projectStatus: "REPORT_APPROVED", latestReportHasRevisionRequest: true }).reason).toBe("REPORT_APPROVED");
    expect(getReportSubmissionGate({ projectStatus: "ADVISOR_SCORING", latestReportHasRevisionRequest: true }).reason).toBe("ADVISOR_SCORING");
    expect(getReportSubmissionGate({ projectStatus: "COMPLETED", latestReportHasRevisionRequest: true }).reason).toBe("COMPLETED");
  });
});

describe("report reviewer rules", () => {
  const committeeAssignments = [
    { teacherId: "head", role: "HEAD" as const, active: true },
    { teacherId: "member", role: "MEMBER" as const, active: true },
    { teacherId: "old-member", role: "MEMBER" as const, active: false },
    { teacherId: "advisor-role", role: "ADVISOR" as const, active: true }
  ];

  it("allows advisors and active HEAD/MEMBER reviewers only", () => {
    expect(
      isAssignedReportReviewer({
        teacherId: "head",
        committeeAssignments,
        advisorRequests: []
      })
    ).toBe(true);
    expect(
      isAssignedReportReviewer({
        teacherId: "advisor",
        committeeAssignments,
        advisorRequests: [{ advisorTeacherId: "advisor", status: "APPROVED" as const }]
      })
    ).toBe(true);
    expect(
      isAssignedReportReviewer({
        teacherId: "old-member",
        committeeAssignments,
        advisorRequests: []
      })
    ).toBe(false);
  });

  it("uses active HEAD/MEMBER and approved advisor as required approvers", () => {
    expect(requiredReportReviewerIds(committeeAssignments, [{ advisorTeacherId: "advisor", status: "APPROVED" as const }])).toEqual(["head", "member", "advisor"]);
    expect(
      allRequiredReportReviewersPassed({
        requiredReviewerIds: ["head", "member", "advisor"],
        reviews: [
          { reviewerTeacherId: "head", decision: "PASS" as const },
          { reviewerTeacherId: "member", decision: "PASS" as const },
          { reviewerTeacherId: "advisor", decision: "PASS" as const }
        ]
      })
    ).toBe(true);
    expect(
      allRequiredReportReviewersPassed({
        requiredReviewerIds: ["head", "member", "advisor"],
        reviews: [
          { reviewerTeacherId: "head", decision: "PASS" as const },
          { reviewerTeacherId: "member", decision: "PASS" as const }
        ]
      })
    ).toBe(false);
  });

  it("keeps an active revision request on the latest report version from being approved", () => {
    expect(latestReportVersionHasRevisionRequest([{ decision: "PASS" as const }])).toBe(false);
    expect(
      latestReportVersionHasRevisionRequest([
        { decision: "PASS" as const },
        { decision: "FAIL" as const }
      ])
    ).toBe(true);
  });
});
