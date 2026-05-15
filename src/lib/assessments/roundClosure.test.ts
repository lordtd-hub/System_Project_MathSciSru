import { describe, expect, it } from "vitest";
import { buildCloseAssessmentRoundData } from "./roundClosure";

describe("assessment round closure", () => {
  it("sets closedAt and closedByAdminId when closing a round", () => {
    const closedAt = new Date("2026-05-06T07:00:00.000Z");
    const data = buildCloseAssessmentRoundData("admin-user-1", "PROPOSAL", closedAt);

    expect(data.status).toBe("SCORING_CLOSED");
    expect(data.closedAt).toBe(closedAt);
    expect(data.closedByAdminId).toBe("admin-user-1");
  });

  it("releases presentation scores and named feedback when closing progress/final rounds", () => {
    const data = buildCloseAssessmentRoundData("admin-user-1", "PROGRESS_1");

    expect(data.showScoreToStudent).toBe(true);
    expect(data.showFeedbackToStudent).toBe(true);
    expect(data.showEvaluatorNameToStudent).toBe(true);
  });

  it("keeps proposal raw scores hidden when closing proposal", () => {
    const data = buildCloseAssessmentRoundData("admin-user-1", "PROPOSAL");

    expect(data).not.toHaveProperty("showScoreToStudent");
    expect(data).not.toHaveProperty("showFeedbackToStudent");
    expect(data).not.toHaveProperty("showEvaluatorNameToStudent");
  });
});
