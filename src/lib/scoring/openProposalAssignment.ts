import type { AssessmentStatus, AssignmentStatus, AttemptType, ProjectStatus } from "@prisma/client";
import { canScoreProposalAttempt } from "./proposalAttemptAccess";

type TeacherRecord = {
  id: string;
  academicPrefix: string;
  firstNameTh: string;
  lastNameTh: string;
  active: boolean;
  isInternal: boolean;
  canEvaluateProposal: boolean;
};

type AttemptRecord = {
  projectId: string;
  assessmentRoundId: string;
  attemptType: AttemptType;
  attemptStatus: AssessmentStatus;
  projectStatus: ProjectStatus;
  roundType: string;
  roundStatus: string;
  hasProposalResult: boolean;
  isLatestProposalAttempt: boolean;
};

type AssignmentRecord = {
  id: string;
  status: AssignmentStatus;
};

export type ProposalAssignmentStore = {
  findTeacher(userId: string): Promise<TeacherRecord | null>;
  findAttempt(attemptId: string): Promise<AttemptRecord | null>;
  hasOpenLateRoundException(projectId: string, assessmentRoundId: string): Promise<boolean>;
  findAssignment(attemptId: string, userId: string): Promise<AssignmentRecord | null>;
  createAssignment(input: {
    attemptId: string;
    userId: string;
    teacherId: string;
    evaluatorDisplayName: string;
  }): Promise<AssignmentRecord>;
};

export type OpenProposalAssignmentResult =
  | { status: "ready"; assignmentId: string; unchanged: boolean }
  | { status: "conflict"; code: "teacher_profile_missing" | "teacher_not_eligible" | "proposal_attempt_missing" | "proposal_decision_already_saved" | "proposal_round_not_open" };

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

export async function openProposalAssignment(
  store: ProposalAssignmentStore,
  input: { attemptId: string; userId: string }
): Promise<OpenProposalAssignmentResult> {
  const teacher = await store.findTeacher(input.userId);
  if (!teacher) return { status: "conflict", code: "teacher_profile_missing" };
  if (!teacher.active || !teacher.isInternal || !teacher.canEvaluateProposal) {
    return { status: "conflict", code: "teacher_not_eligible" };
  }

  const attempt = await store.findAttempt(input.attemptId);
  if (!attempt) return { status: "conflict", code: "proposal_attempt_missing" };
  if (attempt.hasProposalResult) return { status: "conflict", code: "proposal_decision_already_saved" };

  const lateRoundOpen = attempt.attemptType === "MAIN_PROPOSAL" && attempt.roundStatus !== "SCORING_OPEN"
    ? await store.hasOpenLateRoundException(attempt.projectId, attempt.assessmentRoundId)
    : false;
  if (!canScoreProposalAttempt({
    attemptType: attempt.attemptType,
    attemptStatus: attempt.attemptStatus,
    projectStatus: attempt.projectStatus,
    roundType: attempt.roundType,
    roundStatus: attempt.roundStatus,
    hasProposalResult: attempt.hasProposalResult,
    isLatestProposalAttempt: attempt.isLatestProposalAttempt,
    hasOpenLateRoundException: lateRoundOpen
  })) {
    return { status: "conflict", code: "proposal_round_not_open" };
  }

  const existing = await store.findAssignment(input.attemptId, input.userId);
  if (existing) return { status: "ready", assignmentId: existing.id, unchanged: true };

  try {
    const created = await store.createAssignment({
      attemptId: input.attemptId,
      userId: input.userId,
      teacherId: teacher.id,
      evaluatorDisplayName: `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`
    });
    return { status: "ready", assignmentId: created.id, unchanged: false };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const racedAssignment = await store.findAssignment(input.attemptId, input.userId);
    if (!racedAssignment) throw error;
    return { status: "ready", assignmentId: racedAssignment.id, unchanged: true };
  }
}
