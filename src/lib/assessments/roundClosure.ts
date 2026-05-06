export function buildCloseAssessmentRoundData(adminUserId: string, closedAt = new Date()) {
  return {
    status: "SCORING_CLOSED" as const,
    closedAt,
    closedByAdminId: adminUserId
  };
}
