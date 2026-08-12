import type { AssessmentStatus, AttemptType, ProjectStatus } from "@prisma/client";

export type ProposalAttemptAccessContext = {
  attemptType: AttemptType;
  attemptStatus: AssessmentStatus;
  projectStatus: ProjectStatus;
  roundType: string;
  roundStatus: string;
  hasProposalResult: boolean;
  isLatestProposalAttempt: boolean;
  hasOpenLateRoundException: boolean;
};

export function isOpenReproposalAttempt(context: ProposalAttemptAccessContext) {
  return context.roundType === "PROPOSAL"
    && context.attemptType === "REPROPOSAL"
    && context.attemptStatus === "SCORING_OPEN"
    && context.projectStatus === "PROPOSAL_REVIEW"
    && !context.hasProposalResult
    && context.isLatestProposalAttempt;
}

export function canScoreProposalAttempt(context: ProposalAttemptAccessContext) {
  if (context.hasProposalResult || context.roundType !== "PROPOSAL") return false;
  if (context.attemptType === "REPROPOSAL") return isOpenReproposalAttempt(context);
  return context.attemptType === "MAIN_PROPOSAL"
    && context.isLatestProposalAttempt
    && (context.roundStatus === "SCORING_OPEN" || context.hasOpenLateRoundException);
}

export function proposalFeedbackReleaseOutcome(context: {
  hasProposalResult: boolean;
  isLatestProposalAttempt: boolean;
  feedbackAlreadyReleased: boolean;
}) {
  if (!context.hasProposalResult || !context.isLatestProposalAttempt) return "not_available" as const;
  return context.feedbackAlreadyReleased ? "unchanged" as const : "release" as const;
}
