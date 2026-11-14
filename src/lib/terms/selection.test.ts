import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { chooseStudentProject } from "./selection";

const project = (id: string, status = "ACTIVE", yearBe = 2569, termType = "SEMESTER_2") => ({ id,
  courseOffering: { id, status, courseCode: "SMA6002", section: id, term: { id: `${yearBe}-${termType}`, termType, academicYear: { yearBe } } } });
describe("student current enrollment is ACTIVE only", () => {
  const current = project("P01");
  const oldI = { ...project("N01", "CLOSED", 2569, "SEMESTER_1"), academicResult: { status: "INCOMPLETE" } };
  it("selects one owned ACTIVE enrollment", () => expect(chooseStudentProject([current])?.id).toBe("P01"));
  it("does not prefer unresolved I over an ACTIVE enrollment", () => expect(chooseStudentProject([oldI, current])?.id).toBe("P01"));
  it("ignores stale closed, foreign and draft IDs", () => {
    for (const cookie of [oldI.id, "foreign", "draft"]) expect(chooseStudentProject([oldI, current, project("draft", "DRAFT")], cookie)?.id).toBe("P01");
  });
  it("never falls back to closed I, completed history or draft when no ACTIVE exists", () => {
    expect(chooseStudentProject([oldI, project("completed", "CLOSED"), project("draft", "DRAFT")], oldI.id)).toBeNull();
    expect(chooseStudentProject([])).toBeNull();
  });
  it("handles legacy multiple ACTIVE deterministically and honors only an owned ACTIVE selection", () => {
    const second = project("P02");
    expect(chooseStudentProject([second, current])?.id).toBe(chooseStudentProject([current, second])?.id);
    expect(chooseStudentProject([second, current], second.id)?.id).toBe(second.id);
  });
  it("does not mutate historical records while selecting", () => {
    const before = JSON.stringify([oldI, current]); chooseStudentProject([oldI, current], oldI.id);
    expect(JSON.stringify([oldI, current])).toBe(before);
  });
});
