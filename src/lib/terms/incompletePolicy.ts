export const INCOMPLETE_CONTINUATION = "INCOMPLETE_CONTINUATION";
export function canContinueCourse(status: string, resultStatus?: string | null) {
  return status !== "CLOSED" || resultStatus === "INCOMPLETE";
}

export function validateClosingDecisions(unfinishedIds: string[], decisions: Array<{ projectId: string; grade: string; reason: string }>) {
  if (decisions.length !== unfinishedIds.length || new Set(decisions.map(decision => decision.projectId)).size !== decisions.length) return false;
  return decisions.every(decision => unfinishedIds.includes(decision.projectId) && ["I", "E"].includes(decision.grade) && Boolean(decision.reason.trim()) && decision.reason.length <= 2000);
}

export function missingPresentationTypes(attempts: Array<{
  officialScore?: unknown; assessmentRound: { roundType: string };
  evaluatorAssignments: Array<{ scoreSubmission: { status: string } | null }>;
}>) {
  const scored = new Set(attempts.filter(attempt => attempt.officialScore != null || attempt.evaluatorAssignments.some(assignment => assignment.scoreSubmission?.status === "SUBMITTED" || assignment.scoreSubmission?.status === "LOCKED")).map(attempt => attempt.assessmentRound.roundType));
  return ["PROPOSAL", "PROGRESS_1", "PROGRESS_2", "FINAL_PRESENTATION"].filter(type => !scored.has(type));
}
