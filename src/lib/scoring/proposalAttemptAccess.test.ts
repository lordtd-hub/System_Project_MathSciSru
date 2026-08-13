import { describe, expect, it } from "vitest";
import { canScoreProposalAttempt, proposalFeedbackReleaseOutcome } from "./proposalAttemptAccess";

const base = {
  attemptType: "REPROPOSAL" as const,
  attemptStatus: "SCORING_OPEN" as const,
  projectStatus: "PROPOSAL_REVIEW" as const,
  roundType: "PROPOSAL",
  roundStatus: "SCORING_CLOSED",
  hasProposalResult: false,
  isLatestProposalAttempt: true,
  hasOpenLateRoundException: false
};

describe("Proposal attempt access", () => {
  it("opens only the latest Re-proposal attempt without reopening the course round", () => {
    expect(canScoreProposalAttempt(base)).toBe(true);
    expect(canScoreProposalAttempt({ ...base, isLatestProposalAttempt: false })).toBe(false);
    expect(canScoreProposalAttempt({ ...base, attemptStatus: "SCORING_CLOSED" })).toBe(false);
    expect(canScoreProposalAttempt({ ...base, projectStatus: "PROPOSAL_ADMIN_DECISION" })).toBe(false);
    expect(canScoreProposalAttempt({ ...base, hasProposalResult: true })).toBe(false);
  });

  it("keeps the original Proposal round and late-exception rules", () => {
    const main = { ...base, attemptType: "MAIN_PROPOSAL" as const, roundStatus: "SCORING_OPEN" };
    expect(canScoreProposalAttempt(main)).toBe(true);
    expect(canScoreProposalAttempt({ ...main, isLatestProposalAttempt: false })).toBe(false);
    expect(canScoreProposalAttempt({ ...main, roundStatus: "SCORING_CLOSED" })).toBe(false);
    expect(canScoreProposalAttempt({ ...main, roundStatus: "SCORING_CLOSED", hasOpenLateRoundException: true })).toBe(true);
  });

  it("releases feedback only for the latest decided attempt and deduplicates retries", () => {
    expect(proposalFeedbackReleaseOutcome({
      hasProposalResult: true,
      isLatestProposalAttempt: true,
      feedbackAlreadyReleased: false
    })).toBe("release");
    expect(proposalFeedbackReleaseOutcome({
      hasProposalResult: true,
      isLatestProposalAttempt: true,
      feedbackAlreadyReleased: true
    })).toBe("unchanged");
    expect(proposalFeedbackReleaseOutcome({
      hasProposalResult: true,
      isLatestProposalAttempt: false,
      feedbackAlreadyReleased: false
    })).toBe("not_available");
    expect(proposalFeedbackReleaseOutcome({
      hasProposalResult: false,
      isLatestProposalAttempt: true,
      feedbackAlreadyReleased: false
    })).toBe("not_available");
  });
});
