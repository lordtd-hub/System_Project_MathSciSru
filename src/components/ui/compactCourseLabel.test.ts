import { describe, expect, it } from "vitest";
import { compactCourseTerm } from "./compactCourseLabel";

describe("compact course term display", () => {
  it("keeps semesters and Buddhist academic years distinct", () => {
    expect(compactCourseTerm({ termType: "SEMESTER_1", academicYear: { yearBe: 2569 } })).toBe("1/2569");
    expect(compactCourseTerm({ termType: "SEMESTER_2", academicYear: { yearBe: 2570 } })).toBe("2/2570");
  });
  it("does not display summer as semester 1 or 2", () => {
    expect(compactCourseTerm({ termType: "SUMMER", academicYear: { yearBe: 2569 } })).toBe("ฤดูร้อน/2569");
  });
});
