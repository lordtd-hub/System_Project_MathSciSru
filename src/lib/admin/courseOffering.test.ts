import { describe, expect, it } from "vitest";
import { defaultCourseTitle, normalizeTermType, validateCourseOfferingInput } from "./courseOffering";

describe("admin course offering setup", () => {
  it("accepts academic year and simple semester inputs", () => {
    const semester1 = validateCourseOfferingInput({ yearBe: "2569", termType: "1", courseTitle: "  MATH Project  " });
    const semester2 = validateCourseOfferingInput({ yearBe: "2569", termType: "2" });
    const summer = validateCourseOfferingInput({ yearBe: "2569", termType: "summer" });

    expect(semester1).toMatchObject({ ok: true, data: { yearBe: 2569, termType: "SEMESTER_1", courseTitle: "MATH Project" } });
    expect(semester2).toMatchObject({ ok: true, data: { termType: "SEMESTER_2", courseTitle: defaultCourseTitle } });
    expect(summer).toMatchObject({ ok: true, data: { termType: "SUMMER" } });
  });

  it("rejects invalid academic year, term, and overlong course title", () => {
    expect(validateCourseOfferingInput({ yearBe: "69", termType: "1" })).toEqual({ ok: false, error: "invalid_year" });
    expect(validateCourseOfferingInput({ yearBe: "2569.5", termType: "1" })).toEqual({ ok: false, error: "invalid_year" });
    expect(validateCourseOfferingInput({ yearBe: "2569", termType: "3" })).toEqual({ ok: false, error: "invalid_term" });
    expect(validateCourseOfferingInput({ yearBe: "2569", termType: "1", courseTitle: "x".repeat(121) })).toEqual({
      ok: false,
      error: "invalid_course_title"
    });
  });

  it("normalizes enum and plain term values consistently", () => {
    expect(normalizeTermType("SEMESTER_1")).toBe("SEMESTER_1");
    expect(normalizeTermType("SUMMER")).toBe("SUMMER");
    expect(normalizeTermType("summer")).toBe("SUMMER");
    expect(normalizeTermType("")).toBeNull();
  });
});
