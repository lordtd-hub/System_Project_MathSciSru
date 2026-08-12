import type { AssignmentStatus } from "@prisma/client";

type TeacherRecord = {
  id: string;
  academicPrefix: string;
  firstNameTh: string;
  lastNameTh: string;
};

type AttemptRecord = {
  projectId: string;
  assessmentRoundId: string;
  roundType: string;
  roundStatus: string;
  hasProposalResult: boolean;
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
  | { status: "conflict"; code: "teacher_profile_missing" | "proposal_attempt_missing" | "proposal_decision_already_saved" | "proposal_round_not_open" };

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

export async function openProposalAssignment(
  store: ProposalAssignmentStore,
  input: { attemptId: string; userId: string }
): Promise<OpenProposalAssignmentResult> {
  const teacher = await store.findTeacher(input.userId);
  if (!teacher) return { status: "conflict", code: "teacher_profile_missing" };

  const attempt = await store.findAttempt(input.attemptId);
  if (!attempt) return { status: "conflict", code: "proposal_attempt_missing" };
  if (attempt.hasProposalResult) return { status: "conflict", code: "proposal_decision_already_saved" };

  const lateRoundOpen = attempt.roundStatus === "SCORING_OPEN"
    ? false
    : await store.hasOpenLateRoundException(attempt.projectId, attempt.assessmentRoundId);
  if (attempt.roundType !== "PROPOSAL" || (attempt.roundStatus !== "SCORING_OPEN" && !lateRoundOpen)) {
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
