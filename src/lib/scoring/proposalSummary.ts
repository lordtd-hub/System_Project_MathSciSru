import type { Decision, ScoreStatus } from "@prisma/client";

export type ProposalScoreForSummary = {
  totalScore: number;
  status: ScoreStatus;
  decision?: Decision | null;
  reason?: string | null;
  overallComment?: string | null;
  evaluatorDisplayName?: string;
};

export type ProposalSummary = {
  averageScore: number;
  submittedCount: number;
  missingCount: number;
  passCount: number;
  revisionCount: number;
  notPassCount: number;
  comments: Array<{
    evaluatorDisplayName?: string;
    decision?: Decision | null;
    reason?: string | null;
    overallComment?: string | null;
  }>;
};

export function summarizeProposalScores(
  requiredEvaluatorCount: number,
  scores: ProposalScoreForSummary[]
): ProposalSummary {
  const submitted = scores.filter((score) => score.status === "SUBMITTED" || score.status === "LOCKED");
  const total = submitted.reduce((sum, score) => sum + score.totalScore, 0);

  return {
    averageScore: submitted.length ? Number((total / submitted.length).toFixed(2)) : 0,
    submittedCount: submitted.length,
    missingCount: Math.max(requiredEvaluatorCount - submitted.length, 0),
    passCount: submitted.filter((score) => score.decision === "PASS").length,
    revisionCount: submitted.filter((score) => score.decision === "PASS_WITH_REVISION").length,
    notPassCount: submitted.filter((score) => score.decision === "NOT_PASS").length,
    comments: submitted.map((score) => ({
      evaluatorDisplayName: score.evaluatorDisplayName,
      decision: score.decision,
      reason: score.reason,
      overallComment: score.overallComment
    }))
  };
}
