import type { AssessmentStatus, CommitteeRole, ScoreStatus } from "@prisma/client";
import { isRoundClosed } from "@/lib/assessments/courseRounds";

const presentationCommitteeRoles = new Set<CommitteeRole>(["HEAD", "MEMBER"]);

export type PresentationCommitteeAssignment = {
  teacherId: string | null;
  role: CommitteeRole;
  active?: boolean | null;
};

export type PresentationScoreSubmissionEvidence = {
  teacherId: string | null;
  status?: ScoreStatus | null;
};

export function requiredPresentationCommitteeTeacherIds(assignments: PresentationCommitteeAssignment[]) {
  return [
    ...new Set(
      assignments
        .filter((assignment) => assignment.active !== false && presentationCommitteeRoles.has(assignment.role) && assignment.teacherId)
        .map((assignment) => assignment.teacherId as string)
    )
  ];
}

export function isPresentationAssessmentComplete(input: {
  roundStatus?: AssessmentStatus | null;
  committeeAssignments: PresentationCommitteeAssignment[];
  scoreSubmissions: PresentationScoreSubmissionEvidence[];
}) {
  if (input.roundStatus && isRoundClosed(input.roundStatus)) return true;

  const requiredTeacherIds = requiredPresentationCommitteeTeacherIds(input.committeeAssignments);
  if (requiredTeacherIds.length === 0) return false;

  const submittedTeacherIds = new Set(
    input.scoreSubmissions
      .filter((submission) => (submission.status === "SUBMITTED" || submission.status === "LOCKED") && submission.teacherId)
      .map((submission) => submission.teacherId as string)
  );

  return requiredTeacherIds.every((teacherId) => submittedTeacherIds.has(teacherId));
}
