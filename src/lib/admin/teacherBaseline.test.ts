import { describe, expect, it } from "vitest";
import { baselineTeacherRows, normalizeBaselineTeacherEmail } from "@/lib/admin/teacherBaseline";

describe("baseline teacher profiles", () => {
  it("contains the documented internal teacher list without demo teachers", () => {
    expect(baselineTeacherRows).toHaveLength(11);
    expect(baselineTeacherRows.some((teacher) => teacher.firstNameTh === "สิทธิโชค" && teacher.lastNameTh === "ทรงสอาด")).toBe(true);
    expect(baselineTeacherRows.some((teacher) => teacher.email?.startsWith("e2e."))).toBe(false);
  });

  it("normalizes seed emails safely", () => {
    expect(normalizeBaselineTeacherEmail("  Sittichoke.Son@SRU.AC.TH  ")).toBe("sittichoke.son@sru.ac.th");
    expect(normalizeBaselineTeacherEmail("   ")).toBeNull();
    expect(normalizeBaselineTeacherEmail(null)).toBeNull();
  });
});
