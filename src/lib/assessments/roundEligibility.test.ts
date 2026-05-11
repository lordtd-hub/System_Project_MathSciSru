import { describe, expect, it } from "vitest";
import { getProgress1Readiness, reasonLabelTh } from "./roundEligibility";

const baseProject = {
  id: "project-1",
  status: "IN_PROGRESS" as const,
  proposalResults: [{ finalDecision: "PASS" as const }],
  committeeAssignments: [
    { role: "ADVISOR" as const, active: true },
    { role: "HEAD" as const, active: true },
    { role: "MEMBER" as const, active: true }
  ],
  roundExceptions: []
};

describe("round eligibility", () => {
  it("marks a passed project with full committee eligible for Progress 1", () => {
    expect(getProgress1Readiness(baseProject).eligible).toBe(true);
  });

  it("reports missing committee reasons", () => {
    const readiness = getProgress1Readiness({ ...baseProject, committeeAssignments: [{ role: "ADVISOR", active: true }] });
    expect(readiness.eligible).toBe(false);
    expect(readiness.reasons).toContain("missing HEAD");
    expect(readiness.reasons).toContain("missing MEMBER");
  });

  it("does not let failed or revise proposal enter Progress 1", () => {
    const readiness = getProgress1Readiness({ ...baseProject, proposalResults: [{ finalDecision: "NOT_PASS" }] });
    expect(readiness.eligible).toBe(false);
    expect(reasonLabelTh(readiness.reasons[0])).toBe("ยังไม่ผ่านการเสนอหัวข้อ");
  });

  it("shows exact waiting reason before admin confirmation", () => {
    const readiness = getProgress1Readiness({ ...baseProject, status: "PENDING_ADMIN", proposalResults: [] });
    expect(readiness.reasons).toContain("project still PENDING_ADMIN");
  });
});
