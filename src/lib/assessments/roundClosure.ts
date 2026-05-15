import type { AssessmentRoundType } from "@prisma/client";

export function buildCloseAssessmentRoundData(adminUserId: string, roundType?: AssessmentRoundType, closedAt = new Date()) {
  const shouldReleasePresentationResult =
    roundType === "PROGRESS_1" || roundType === "PROGRESS_2" || roundType === "FINAL_PRESENTATION";

  return {
    status: "SCORING_CLOSED" as const,
    closedAt,
    closedByAdminId: adminUserId,
    ...(shouldReleasePresentationResult
      ? {
          showScoreToStudent: true,
          showFeedbackToStudent: true,
          showEvaluatorNameToStudent: true
        }
      : {})
  };
}
