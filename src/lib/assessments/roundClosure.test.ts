import { describe, expect, it } from "vitest";
import { buildCloseAssessmentRoundData } from "./roundClosure";

describe("assessment round closure", () => {
  it("sets closedAt and closedByAdminId when closing a round", () => {
    const closedAt = new Date("2026-05-06T07:00:00.000Z");
    const data = buildCloseAssessmentRoundData("admin-user-1", closedAt);

    expect(data.status).toBe("SCORING_CLOSED");
    expect(data.closedAt).toBe(closedAt);
    expect(data.closedByAdminId).toBe("admin-user-1");
  });
});
