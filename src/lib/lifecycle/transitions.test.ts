import { describe, expect, it } from "vitest";
import {
  adminConfirmProjectTransition,
  advisorApproveTransition,
  advisorRejectTransition,
  advisorScoreStatus,
  isScheduleConfirmed,
  proposalFinalDecisionTransition,
  shouldAlertAdminForFailVotes
} from "./transitions";

describe("Project Lifecycle v2 transitions", () => {
  it("advisor reject returns the project to DRAFT and keeps history", () => {
    expect(advisorRejectTransition()).toMatchObject({
      from: "PENDING_ADVISOR",
      to: "DRAFT",
      keepHistory: true
    });
  });

  it("advisor approve sends the project to PENDING_ADMIN", () => {
    expect(advisorApproveTransition()).toMatchObject({
      from: "PENDING_ADVISOR",
      to: "PENDING_ADMIN"
    });
  });

  it("admin confirm sends the project to PROPOSAL_PENDING", () => {
    expect(adminConfirmProjectTransition()).toMatchObject({
      from: "PENDING_ADMIN",
      to: "PROPOSAL_PENDING"
    });
  });

  it("proposal FAIL final decision returns to DRAFT and keeps history", () => {
    expect(proposalFinalDecisionTransition("FAIL")).toMatchObject({
      from: "PROPOSAL_ADMIN_DECISION",
      to: "DRAFT",
      keepHistory: true
    });
  });

  it("proposal PASS final decision goes to TOPIC_APPROVED", () => {
    expect(proposalFinalDecisionTransition("PASS")).toMatchObject({
      from: "PROPOSAL_ADMIN_DECISION",
      to: "TOPIC_APPROVED"
    });
  });

  it("alerts admin when FAIL votes are at least 50 percent", () => {
    expect(shouldAlertAdminForFailVotes([{ vote: "FAIL" }, { vote: "PASS" }])).toBe(true);
    expect(shouldAlertAdminForFailVotes([{ vote: "FAIL" }, { vote: "REVISE" }, { vote: "PASS" }])).toBe(false);
  });

  it("confirms schedule only when all committee members approve", () => {
    expect(
      isScheduleConfirmed(
        ["t1", "t2"],
        [
          { teacherId: "t1", decision: "APPROVE" },
          { teacherId: "t2", decision: "APPROVE" }
        ]
      )
    ).toBe(true);
    expect(
      isScheduleConfirmed(
        ["t1", "t2"],
        [
          { teacherId: "t1", decision: "APPROVE" },
          { teacherId: "t2", decision: "REJECT" }
        ]
      )
    ).toBe(false);
  });

  it("keeps advisor score locked until report is closed by advisor", () => {
    expect(advisorScoreStatus({ reportClosedByAdvisor: false, allReportReviewersPassed: true })).toBe("LOCKED");
    expect(advisorScoreStatus({ reportClosedByAdvisor: true, allReportReviewersPassed: false })).toBe("LOCKED");
    expect(advisorScoreStatus({ reportClosedByAdvisor: true, allReportReviewersPassed: true })).toBe("DRAFT");
  });
});
