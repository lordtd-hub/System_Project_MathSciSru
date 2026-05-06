import type { ProjectStatus, ScheduleApprovalDecision } from "@prisma/client";

export type ProjectTransition = {
  from: ProjectStatus;
  to: ProjectStatus;
  reason: string;
  keepHistory: true;
};

export type ProposalFinalDecisionV2 = "PASS" | "REVISE" | "FAIL";
export type RevisionTarget = "DRAFT" | "PROPOSAL_PENDING";

export function advisorRejectTransition(from: ProjectStatus = "PENDING_ADVISOR"): ProjectTransition {
  return {
    from,
    to: "DRAFT",
    reason: "ADVISOR_REJECTED",
    keepHistory: true
  };
}

export function advisorApproveTransition(from: ProjectStatus = "PENDING_ADVISOR"): ProjectTransition {
  return {
    from,
    to: "PENDING_ADMIN",
    reason: "ADVISOR_APPROVED",
    keepHistory: true
  };
}

export function adminConfirmProjectTransition(from: ProjectStatus = "PENDING_ADMIN"): ProjectTransition {
  return {
    from,
    to: "PROPOSAL_PENDING",
    reason: "ADMIN_CONFIRMED_PROJECT_ADVISOR",
    keepHistory: true
  };
}

export function proposalFinalDecisionTransition(
  decision: ProposalFinalDecisionV2,
  revisionTarget: RevisionTarget = "DRAFT",
  from: ProjectStatus = "PROPOSAL_ADMIN_DECISION"
): ProjectTransition {
  if (decision === "PASS") {
    return { from, to: "TOPIC_APPROVED", reason: "PROPOSAL_FINAL_PASS", keepHistory: true };
  }
  if (decision === "FAIL") {
    return { from, to: "DRAFT", reason: "PROPOSAL_FINAL_FAIL", keepHistory: true };
  }
  return {
    from,
    to: revisionTarget,
    reason: revisionTarget === "DRAFT" ? "PROPOSAL_FINAL_REVISE_TO_DRAFT" : "PROPOSAL_FINAL_REVISE_TO_PROPOSAL_PENDING",
    keepHistory: true
  };
}

export type ProposalVoteLike = {
  vote: "PASS" | "REVISE" | "FAIL";
};

export function shouldAlertAdminForFailVotes(votes: ProposalVoteLike[]): boolean {
  if (votes.length === 0) return false;
  const failCount = votes.filter((vote) => vote.vote === "FAIL").length;
  return failCount / votes.length >= 0.5;
}

export type ScheduleApprovalLike = {
  teacherId: string;
  decision: ScheduleApprovalDecision;
};

export function isScheduleConfirmed(committeeTeacherIds: string[], approvals: ScheduleApprovalLike[]): boolean {
  if (committeeTeacherIds.length === 0) return false;
  const approvalByTeacher = new Map(approvals.map((approval) => [approval.teacherId, approval.decision]));
  return committeeTeacherIds.every((teacherId) => approvalByTeacher.get(teacherId) === "APPROVE");
}

export type AdvisorScoreLockInput = {
  reportClosedByAdvisor: boolean;
  allReportReviewersPassed: boolean;
};

export function isAdvisorScoreUnlocked(input: AdvisorScoreLockInput): boolean {
  return input.reportClosedByAdvisor && input.allReportReviewersPassed;
}

export function advisorScoreStatus(input: AdvisorScoreLockInput): "LOCKED" | "DRAFT" {
  return isAdvisorScoreUnlocked(input) ? "DRAFT" : "LOCKED";
}
