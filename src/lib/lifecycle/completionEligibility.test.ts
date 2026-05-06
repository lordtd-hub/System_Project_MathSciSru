import { describe, expect, it } from "vitest";
import { completionRequirementLabels, evaluateCompletionEligibility, type CompletionCheckInput } from "./completionEligibility";

const completeInput: CompletionCheckInput = {
  currentState: "ADVISOR_SCORING",
  hasProgress1Score: true,
  hasProgress2Score: true,
  hasFinalPresentationScore: true,
  hasReachedReportApproved: true,
  hasAdvisorScore: true,
  hasUnresolvedReportRevision: false
};

describe("completion eligibility", () => {
  it("is eligible only when every closeout requirement is complete", () => {
    const result = evaluateCompletionEligibility(completeInput);

    expect(result.eligible).toBe(true);
    expect(result.missingRequirements).toEqual([]);
  });

  it("requires the project to be in ADVISOR_SCORING", () => {
    const result = evaluateCompletionEligibility({ ...completeInput, currentState: "REPORT_APPROVED" });

    expect(result.eligible).toBe(false);
    expect(result.missingRequirements).toContain(completionRequirementLabels.state);
  });

  it("reports missing Progress 1, Progress 2, and Final scores separately", () => {
    const result = evaluateCompletionEligibility({
      ...completeInput,
      hasProgress1Score: false,
      hasProgress2Score: false,
      hasFinalPresentationScore: false
    });

    expect(result.eligible).toBe(false);
    expect(result.missingRequirements).toEqual([
      completionRequirementLabels.progress1,
      completionRequirementLabels.progress2,
      completionRequirementLabels.final
    ]);
  });

  it("requires report approval evidence", () => {
    const result = evaluateCompletionEligibility({ ...completeInput, hasReachedReportApproved: false });

    expect(result.eligible).toBe(false);
    expect(result.missingRequirements).toContain(completionRequirementLabels.reportApproved);
  });

  it("requires advisor score", () => {
    const result = evaluateCompletionEligibility({ ...completeInput, hasAdvisorScore: false });

    expect(result.eligible).toBe(false);
    expect(result.missingRequirements).toContain(completionRequirementLabels.advisorScore);
  });

  it("blocks closeout while a report revision is unresolved", () => {
    const result = evaluateCompletionEligibility({ ...completeInput, hasUnresolvedReportRevision: true });

    expect(result.eligible).toBe(false);
    expect(result.missingRequirements).toContain(completionRequirementLabels.reportRevision);
  });
});
