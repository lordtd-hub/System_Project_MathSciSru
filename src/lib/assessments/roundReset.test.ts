import { describe, expect, it } from "vitest";
import { getCourseRoundResetState } from "@/lib/assessments/roundReset";

describe("course round reset safety", () => {
  it("allows resetting an opened or closed round only when no evidence exists", () => {
    expect(getCourseRoundResetState("SCORING_OPEN", { attempts: 0, projectExceptions: 0, scheduleProposals: 0 })).toMatchObject({
      canReset: true
    });
    expect(getCourseRoundResetState("SCORING_CLOSED", { attempts: 0, projectExceptions: 0, scheduleProposals: 0 })).toMatchObject({
      canReset: true
    });
  });

  it("blocks reset when the round is still draft", () => {
    expect(getCourseRoundResetState("DRAFT", { attempts: 0, projectExceptions: 0, scheduleProposals: 0 })).toMatchObject({
      canReset: false,
      reasonKey: "round_not_started"
    });
  });

  it("blocks reset when submissions, schedules, or exceptions exist", () => {
    expect(getCourseRoundResetState("SCORING_CLOSED", { attempts: 1, projectExceptions: 0, scheduleProposals: 0 })).toMatchObject({
      canReset: false,
      reasonKey: "round_has_evidence"
    });
    expect(getCourseRoundResetState("SUBMISSION_OPEN", { attempts: 0, projectExceptions: 1, scheduleProposals: 0 })).toMatchObject({
      canReset: false,
      reasonKey: "round_has_evidence"
    });
    expect(getCourseRoundResetState("SUBMISSION_OPEN", { attempts: 0, projectExceptions: 0, scheduleProposals: 1 })).toMatchObject({
      canReset: false,
      reasonKey: "round_has_evidence"
    });
  });
});
