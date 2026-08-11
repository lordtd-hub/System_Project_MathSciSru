import { describe, expect, it } from "vitest";
import { isSubmittedScoreStatus } from "./scoreSubmissionStatus";

describe("submitted score status", () => {
  it("counts submitted and locked scores as completed", () => {
    expect(isSubmittedScoreStatus("SUBMITTED")).toBe(true);
    expect(isSubmittedScoreStatus("LOCKED")).toBe(true);
  });

  it("does not count draft or missing scores as completed", () => {
    expect(isSubmittedScoreStatus("DRAFT")).toBe(false);
    expect(isSubmittedScoreStatus(null)).toBe(false);
    expect(isSubmittedScoreStatus(undefined)).toBe(false);
  });
});
