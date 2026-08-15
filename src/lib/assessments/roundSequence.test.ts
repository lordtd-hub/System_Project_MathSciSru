import { describe, expect, it } from "vitest";
import { getRoundOpenGate } from "@/lib/assessments/roundSequence";

describe("course round sequence gating", () => {
  it("allows Proposal to open first", () => {
    expect(getRoundOpenGate("PROPOSAL", {}).canOpen).toBe(true);
  });

  it("blocks Progress 1 until Proposal is closed and projects are eligible", () => {
    expect(getRoundOpenGate("PROGRESS_1", { PROPOSAL: "DRAFT" }, { progress1EligibleCount: 3 })).toMatchObject({
      canOpen: false,
      reasonKey: "proposal_must_close_first"
    });
    expect(getRoundOpenGate("PROGRESS_1", { PROPOSAL: "SCORING_CLOSED" }, { progress1EligibleCount: 0 })).toMatchObject({
      canOpen: false,
      reasonKey: "progress_1_not_ready"
    });
    expect(getRoundOpenGate("PROGRESS_1", { PROPOSAL: "SCORING_CLOSED" }, { progress1EligibleCount: 1 }).canOpen).toBe(true);
  });

  it("allows only the explicit Progress 1 zero-ready override after Proposal closes", () => {
    expect(getRoundOpenGate(
      "PROGRESS_1",
      { PROPOSAL: "SCORING_CLOSED" },
      { progress1EligibleCount: 0, allowZeroReadyProgress1: true }
    ).canOpen).toBe(true);
    expect(getRoundOpenGate(
      "PROGRESS_1",
      { PROPOSAL: "SCORING_OPEN" },
      { progress1EligibleCount: 0, allowZeroReadyProgress1: true }
    )).toMatchObject({ canOpen: false, reasonKey: "proposal_must_close_first" });
    expect(getRoundOpenGate(
      "PROGRESS_2",
      { PROGRESS_1: "DRAFT" },
      { progress1EligibleCount: 0, allowZeroReadyProgress1: true }
    )).toMatchObject({ canOpen: false, reasonKey: "progress_1_must_close_first" });
  });

  it("blocks Progress 2 and Final until previous rounds are closed", () => {
    expect(getRoundOpenGate("PROGRESS_2", { PROGRESS_1: "DRAFT" })).toMatchObject({
      canOpen: false,
      reasonKey: "progress_1_must_close_first"
    });
    expect(getRoundOpenGate("PROGRESS_2", { PROGRESS_1: "SUBMISSION_CLOSED" }).canOpen).toBe(true);
    expect(getRoundOpenGate("FINAL_PRESENTATION", { PROGRESS_2: "DRAFT" })).toMatchObject({
      canOpen: false,
      reasonKey: "progress_2_must_close_first"
    });
    expect(getRoundOpenGate("FINAL_PRESENTATION", { PROGRESS_2: "SUBMISSION_CLOSED" }).canOpen).toBe(true);
  });

  it("does not reopen already open or closed rounds", () => {
    expect(getRoundOpenGate("PROPOSAL", { PROPOSAL: "SCORING_OPEN" })).toMatchObject({
      canOpen: false,
      reasonKey: "round_already_open"
    });
    expect(getRoundOpenGate("PROPOSAL", { PROPOSAL: "SCORING_CLOSED" })).toMatchObject({
      canOpen: false,
      reasonKey: "round_already_closed"
    });
  });
});
