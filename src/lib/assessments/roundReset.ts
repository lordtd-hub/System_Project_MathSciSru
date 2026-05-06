import type { AssessmentStatus } from "@prisma/client";
import { isRoundClosed, isRoundOpen } from "./courseRounds";

export type CourseRoundResetEvidenceCounts = {
  attempts: number;
  projectExceptions: number;
  scheduleProposals: number;
};

export type CourseRoundResetState = {
  canReset: boolean;
  reasonKey?: "round_not_started" | "round_has_evidence";
};

export function getCourseRoundResetState(status: AssessmentStatus, evidenceCounts: CourseRoundResetEvidenceCounts): CourseRoundResetState {
  if (!isRoundOpen(status) && !isRoundClosed(status)) {
    return { canReset: false, reasonKey: "round_not_started" };
  }

  if (evidenceCounts.attempts > 0 || evidenceCounts.projectExceptions > 0 || evidenceCounts.scheduleProposals > 0) {
    return { canReset: false, reasonKey: "round_has_evidence" };
  }

  return { canReset: true };
}
