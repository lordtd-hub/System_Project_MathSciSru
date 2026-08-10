import { describe, expect, it } from "vitest";
import {
  isAdvisorScoreEditable,
  isPresentationScoreEditable,
  isProposalScoreEditable
} from "./scoreEditability";

const lateException = [{ exceptionType: "LATE_ASSESSMENT_ROUND", status: "OPEN" }];

describe("score editability", () => {
  it("keeps Proposal editable after submit until Admin records the final decision", () => {
    expect(isProposalScoreEditable({ roundStatus: "SCORING_OPEN", hasAdminDecision: false })).toBe(true);
    expect(isProposalScoreEditable({ roundStatus: "SCORING_OPEN", hasAdminDecision: true })).toBe(false);
    expect(isProposalScoreEditable({ roundStatus: "SCORING_CLOSED", hasAdminDecision: false })).toBe(false);
  });

  it("allows an explicit late-round exception but never overrides a Proposal final decision", () => {
    expect(isProposalScoreEditable({ roundStatus: "SCORING_CLOSED", hasAdminDecision: false, roundExceptions: lateException })).toBe(true);
    expect(isProposalScoreEditable({ roundStatus: "SCORING_CLOSED", hasAdminDecision: true, roundExceptions: lateException })).toBe(false);
  });

  it("keeps Progress and Final scores editable until the course round closes", () => {
    expect(isPresentationScoreEditable({ roundStatus: "SUBMISSION_OPEN" })).toBe(true);
    expect(isPresentationScoreEditable({ roundStatus: "SCORING_OPEN" })).toBe(true);
    expect(isPresentationScoreEditable({ roundStatus: "SCORING_CLOSED" })).toBe(false);
    expect(isPresentationScoreEditable({ roundStatus: "SCORING_CLOSED", roundExceptions: lateException })).toBe(true);
  });

  it("keeps Advisor score editable until Admin completes the project", () => {
    expect(isAdvisorScoreEditable("REPORT_APPROVED")).toBe(true);
    expect(isAdvisorScoreEditable("ADVISOR_SCORING")).toBe(true);
    expect(isAdvisorScoreEditable("COMPLETED")).toBe(false);
  });
});
