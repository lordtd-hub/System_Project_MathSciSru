import { describe, expect, it } from "vitest";
import { summarizeProposalScores } from "./proposalSummary";

describe("summarizeProposalScores", () => {
  it("excludes missing and draft scores from the average", () => {
    const summary = summarizeProposalScores(4, [
      { totalScore: 80, status: "SUBMITTED", decision: "PASS" },
      { totalScore: 60, status: "LOCKED", decision: "PASS_WITH_REVISION" },
      { totalScore: 10, status: "DRAFT", decision: "NOT_PASS" }
    ]);

    expect(summary.averageScore).toBe(70);
    expect(summary.submittedCount).toBe(2);
    expect(summary.missingCount).toBe(2);
    expect(summary.passCount).toBe(1);
    expect(summary.revisionCount).toBe(1);
    expect(summary.notPassCount).toBe(0);
  });
});
