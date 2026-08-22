import { describe, expect, it } from "vitest";
import { getAssessmentCardState, getNextActionForAdmin, getNextActionForStudent, getNextActionForTeacher, getProposalStudentNextAction, getStudentAvailableActions } from "./nextActions";
import { getProposalStudentVisibility } from "./visibility";

describe("next action helpers", () => {
  it("guides students by lifecycle status", () => {
    expect(getNextActionForStudent("STUDENT_PROFILE").href).toBe("/student/profile");
    expect(getNextActionForStudent("PENDING_ADVISOR").title).toContain("รออาจารย์ที่ปรึกษา");
    expect(getNextActionForStudent("PROPOSAL_PENDING").href).toBe("/student/proposal");
  });

  it("groups student actions by lifecycle status", () => {
    const profile = getStudentAvailableActions("STUDENT_PROFILE");
    expect(profile.available_now.map((item) => item.key)).toEqual(["student_profile"]);
    expect(profile.locked_future.some((item) => item.key === "proposal")).toBe(true);

    const waitingAdvisor = getStudentAvailableActions("PENDING_ADVISOR");
    expect(waitingAdvisor.blocked_waiting_for[0].title).toContain("รออาจารย์");
    expect(waitingAdvisor.available_now.some((item) => item.key === "proposal")).toBe(false);

    const review = getStudentAvailableActions("PROPOSAL_REVIEW");
    expect(review.read_only_history.some((item) => item.key === "proposal")).toBe(true);
    expect(review.available_now.some((item) => item.key === "proposal")).toBe(false);
  });

  it("only exposes the current in-progress assessment as editable", () => {
    const progress2 = getStudentAvailableActions("IN_PROGRESS", { PROGRESS_1: "COMPLETED" });
    expect(progress2.available_now.map((item) => item.key)).toContain("progress_2");
    expect(progress2.read_only_history.map((item) => item.key)).toContain("progress_1");
    expect(progress2.available_now.map((item) => item.key)).not.toContain("progress_1");

    const afterFinal = getStudentAvailableActions("IN_PROGRESS", {
      PROGRESS_1: "COMPLETED",
      PROGRESS_2: "COMPLETED",
      FINAL_PRESENT: "COMPLETED"
    });
    expect(afterFinal.available_now.map((item) => item.key)).toContain("report");
    expect(afterFinal.read_only_history.map((item) => item.key)).toEqual(["proposal", "progress_1", "progress_2", "final_present"]);
    expect(afterFinal.blocked_waiting_for.map((item) => item.key)).not.toContain("waiting_after_final");
  });

  it("blocks future assessment actions until the course round is open", () => {
    const progress2Closed = getStudentAvailableActions(
      "IN_PROGRESS",
      { PROGRESS_1: "COMPLETED" },
      undefined,
      { roundAvailability: { PROGRESS_2: false } }
    );
    expect(progress2Closed.available_now.map((item) => item.key)).not.toContain("progress_2");
    expect(progress2Closed.blocked_waiting_for.map((item) => item.key)).toContain("progress_2_round_closed");

    const progress2Open = getStudentAvailableActions(
      "IN_PROGRESS",
      { PROGRESS_1: "COMPLETED" },
      undefined,
      { roundAvailability: { PROGRESS_2: true } }
    );
    expect(progress2Open.available_now.map((item) => item.key)).toContain("progress_2");

    const finalClosed = getStudentAvailableActions(
      "IN_PROGRESS",
      { PROGRESS_1: "COMPLETED", PROGRESS_2: "COMPLETED" },
      undefined,
      { roundAvailability: { FINAL_PRESENT: false } }
    );
    expect(finalClosed.available_now.map((item) => item.key)).not.toContain("final_present");
    expect(finalClosed.blocked_waiting_for.map((item) => item.key)).toContain("final_present_round_closed");
  });

  it("shows a blocked late state when Proposal round is closed before submission", () => {
    const closedProposal = getStudentAvailableActions("PROPOSAL_PENDING", {}, undefined, { proposalRoundOpen: false });
    expect(closedProposal.available_now.map((item) => item.key)).not.toContain("proposal");
    expect(closedProposal.blocked_waiting_for.map((item) => item.key)).toContain("proposal_round_closed");
    expect(closedProposal.blocked_waiting_for[0].title).toBe("รอบส่ง Proposal ครั้งแรกสิ้นสุดแล้ว");

    const openProposal = getStudentAvailableActions("PROPOSAL_PENDING", {}, undefined, { proposalRoundOpen: true });
    expect(openProposal.available_now.map((item) => item.key)).toContain("proposal");
  });

  it("prioritizes a permitted Re-proposal over the closed course round", () => {
    const proposal = {
      latestAttemptNo: 1,
      latestAttemptType: "MAIN_PROPOSAL" as const,
      latestResultAttemptNo: 1,
      latestDecision: "NOT_PASS" as const
    };
    const nextAction = getProposalStudentNextAction("PROPOSAL_PENDING", proposal);
    const actions = getStudentAvailableActions("PROPOSAL_PENDING", {}, undefined, {
      proposalRoundOpen: false,
      proposal
    });

    expect(nextAction?.title).toBe("พร้อมส่ง Proposal สำหรับการสอบหัวข้อครั้งถัดไป");
    expect(nextAction?.title).not.toMatch(/ครั้งที่\s*\d/);
    expect(nextAction?.actionLabel).toBe("กรอกและส่ง Proposal ฉบับใหม่");
    expect(actions.available_now.map((item) => item.key)).toContain("reproposal");
    expect(actions.blocked_waiting_for.map((item) => item.key)).not.toContain("proposal_round_closed");
  });

  it("uses stable general copy across later Re-proposal cycles", () => {
    const failedLaterAttempt = {
      latestAttemptNo: 3,
      latestAttemptType: "REPROPOSAL" as const,
      latestResultAttemptNo: 3,
      latestDecision: "NOT_PASS" as const
    };
    const nextPreparation = getProposalStudentNextAction("DRAFT", failedLaterAttempt);
    const submittedAgain = getProposalStudentNextAction("PROPOSAL_REVIEW", {
      latestAttemptNo: 4,
      latestAttemptType: "REPROPOSAL",
      latestResultAttemptNo: 3,
      latestDecision: "NOT_PASS"
    });

    expect(nextPreparation?.title).toBe("เริ่มเตรียมการสอบหัวข้อครั้งถัดไป");
    expect(submittedAgain?.title).toBe("ส่ง Proposal ฉบับใหม่แล้ว");
    expect(`${nextPreparation?.title} ${submittedAgain?.title}`).not.toMatch(/ครั้งที่\s*\d/);
  });

  it("keeps PASS_WITH_REVISION in the revision flow instead of Re-proposal", () => {
    const action = getProposalStudentNextAction("PROPOSAL_REVISION_REQUIRED", {
      latestAttemptNo: 2,
      latestAttemptType: "REPROPOSAL",
      latestResultAttemptNo: 2,
      latestDecision: "PASS_WITH_REVISION"
    });
    const actions = getStudentAvailableActions("PROPOSAL_REVISION_REQUIRED", {}, undefined, {
      proposalRevisionSubmitted: false,
      proposal: {
        latestAttemptNo: 2,
        latestAttemptType: "REPROPOSAL",
        latestResultAttemptNo: 2,
        latestDecision: "PASS_WITH_REVISION"
      }
    });

    expect(action).toBeNull();
    expect(actions.available_now.map((item) => item.key)).toContain("proposal_revision");
    expect(actions.available_now.map((item) => item.key)).not.toContain("reproposal");
  });

  it("shows Re-proposal waiting states without exposing an attempt number", () => {
    const proposal = {
      latestAttemptNo: 2,
      latestAttemptType: "REPROPOSAL" as const,
      latestResultAttemptNo: 2,
      latestDecision: "NOT_PASS" as const
    };

    expect(getProposalStudentNextAction("PENDING_ADVISOR", proposal)?.title).toBe("รออาจารย์ที่ปรึกษาพิจารณาหัวข้อใหม่");
    expect(getProposalStudentNextAction("PENDING_ADMIN", proposal)?.title).toBe("รอผู้ดูแลระบบอนุมัติหัวข้อและที่ปรึกษา");
    expect(getProposalStudentNextAction("PROPOSAL_ADMIN_DECISION", {
      ...proposal,
      latestAttemptNo: 3,
      latestResultAttemptNo: 2
    })?.title).toBe("รอบันทึกมติการสอบหัวข้อรอบใหม่");
  });
  it("shows a submitted Proposal revision as history while waiting for the advisor", () => {
    const revision = getStudentAvailableActions("PROPOSAL_REVISION_REQUIRED", {}, undefined, {
      proposalRevisionSubmitted: true
    });

    expect(revision.available_now.map((item) => item.key)).not.toContain("proposal_revision");
    expect(revision.read_only_history.map((item) => item.key)).toContain("proposal_revision");
    expect(revision.blocked_waiting_for.map((item) => item.key)).toContain("waiting_revision_approval");
  });

  it("keeps completed projects out of pending student action groups", () => {
    const completed = getStudentAvailableActions("COMPLETED");
    expect(completed.available_now).toEqual([]);
    expect(completed.blocked_waiting_for).toEqual([]);
    expect(completed.locked_future).toEqual([]);
    expect(completed.read_only_history.map((item) => item.key)).toEqual(["all_history"]);
  });

  it("makes completed assessment cards read-only and future cards locked", () => {
    expect(getAssessmentCardState("PROGRESS_1", "IN_PROGRESS", { PROGRESS_1: true }).editable).toBe(false);
    expect(getAssessmentCardState("PROGRESS_1", "IN_PROGRESS", { PROGRESS_1: true }).buttonLabel).toBe("ดูข้อเสนอแนะ");
    expect(getAssessmentCardState("PROGRESS_2", "IN_PROGRESS", { PROGRESS_1: false }).label).toBe("ยังไม่ถึงขั้นตอน");
    expect(getAssessmentCardState("PROGRESS_2", "IN_PROGRESS", { PROGRESS_1: true }, "NONE", false, false).editable).toBe(false);
  });

  it("prioritizes teacher tasks", () => {
    expect(
      getNextActionForTeacher({
        pendingAdvisorRequests: 1,
        pendingProposalScores: 2,
        pendingScheduleApprovals: 0,
        pendingReportReviews: 0,
        advisorScoreUnlocked: false
      }).href
    ).toBe("/teacher/advisor-requests");
  });

  it("routes unlocked advisor score to advisor scoring page", () => {
    expect(
      getNextActionForTeacher({
        pendingAdvisorRequests: 0,
        pendingProposalScores: 0,
        pendingScheduleApprovals: 0,
        pendingReportReviews: 0,
        advisorScoreUnlocked: true
      }).href
    ).toBe("/teacher/advisor-score");
  });

  it("prioritizes admin confirmation and fail vote alerts", () => {
    expect(getNextActionForAdmin([{ status: "PENDING_ADMIN" }]).href).toBe("/admin");
    expect(getNextActionForAdmin([{ status: "PROPOSAL_ADMIN_DECISION", proposalVotes: [{ vote: "FAIL" }, { vote: "PASS" }] }]).tone).toBe("warning");
  });

  it("routes submitted proposal assessments to admin final decision", () => {
    const action = getNextActionForAdmin([{ status: "PROPOSAL_ADMIN_DECISION" }]);

    expect(action.href).toBe("/admin/proposals");
    expect(action.title).toContain("การเสนอหัวข้อ");
  });

  it("routes admin closeout states to the closeout page", () => {
    expect(getNextActionForAdmin([{ status: "ADVISOR_SCORING" }]).href).toBe("/admin/closeout");
    expect(getNextActionForAdmin([{ status: "REPORT_APPROVED" }]).href).toBe("/admin/closeout");
  });
});

describe("proposal student visibility", () => {
  it("hides proposal score but shows teacher names and comments", () => {
    const visibility = getProposalStudentVisibility([{ teacherName: "อ.ทดสอบ", comment: "ควรปรับ scope", vote: "REVISE" }]);

    expect(visibility.showScore).toBe(false);
    expect(visibility.showTeacherNames).toBe(true);
    expect(visibility.comments[0].teacherName).toBe("อ.ทดสอบ");
  });
});
