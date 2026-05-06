import { describe, expect, it } from "vitest";
import { calculateChecklistScore, validateProposalDecision } from "./checklistScoring";

describe("calculateChecklistScore", () => {
  it("awards full points for checked items and zero for unchecked items", () => {
    const result = calculateChecklistScore([
      { id: "a", points: 3, checked: true },
      { id: "b", points: 4, checked: false },
      { id: "c", points: 5, checked: true }
    ]);

    expect(result.totalScore).toBe(8);
    expect(result.maxScore).toBe(12);
  });

  it("returns warnings for unchecked critical items", () => {
    const result = calculateChecklistScore([
      { id: "problem", label: "ปัญหาหลัก", points: 4, checked: false, isCritical: true }
    ]);

    expect(result.criticalWarnings).toEqual(["ปัญหาหลัก"]);
  });
});

describe("validateProposalDecision", () => {
  it("requires a reason for revision and not-pass decisions", () => {
    expect(validateProposalDecision("PASS_WITH_REVISION")).toHaveLength(1);
    expect(validateProposalDecision("NOT_PASS", "ยังไม่ชัดเจน")).toHaveLength(0);
    expect(validateProposalDecision("PASS")).toHaveLength(0);
  });
});
