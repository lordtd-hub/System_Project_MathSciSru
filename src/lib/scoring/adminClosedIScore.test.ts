import { describe, expect, it } from "vitest";
import { allowedAdminRubricPoints, preserveAdminIPenalty } from "./adminClosedIScore";
describe("admin entry preserves the real rubric and existing deductions", () => {
  it("keeps legacy checklist scores at zero or full points", () => {
    expect(allowedAdminRubricPoints("PROGRESS_2", { itemKey: "legacy", points: 5 })).toEqual([0, 5]);
  });
  it("does not create a penalty merely because an assessment is I", () => {
    expect(preserveAdminIPenalty(null, undefined, false)).toBe(false);
    expect(preserveAdminIPenalty({ totalScore: 100, items: [{ points: 100 }] }, 0, false)).toBe(false);
  });
  it("retains an applied penalty after the original late exception is closed", () => {
    expect(preserveAdminIPenalty({ totalScore: 90, items: [{ points: 40 }, { points: 60 }] }, 10, false)).toBe(true);
    expect(preserveAdminIPenalty({ totalScore: 0, items: [{ points: 0 }] }, 10, false)).toBe(true);
  });
  it("applies a current real late flag when no earlier deduction applied", () => {
    expect(preserveAdminIPenalty({ totalScore: 100, items: [{ points: 100 }] }, 0, true)).toBe(true);
  });
  it("refuses to infer or waive a historical adjustment without matching evidence", () => {
    expect(() => preserveAdminIPenalty({ totalScore: 90, items: [{ points: 100 }] }, undefined, false)).toThrow("ต้องตรวจประวัติ");
    expect(() => preserveAdminIPenalty({ totalScore: 80, items: [{ points: 100 }] }, 10, false)).toThrow("ไม่ตรงกัน");
    expect(() => preserveAdminIPenalty({ totalScore: 80, items: [] }, undefined, false)).toThrow("ต้องตรวจประวัติ");
  });
});
