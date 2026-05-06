import { describe, expect, it } from "vitest";
import { findDuplicateActiveProjectGroups, getCurrentDashboardProjects } from "./dashboardProjects";

const baseProject = {
  courseOfferingId: "course-1",
  studentId: "student-1"
};

describe("admin dashboard project selection", () => {
  it("keeps one current project per student and course offering", () => {
    const older = { ...baseProject, id: "old", updatedAt: new Date("2026-05-06T01:00:00.000Z") };
    const newer = { ...baseProject, id: "new", updatedAt: new Date("2026-05-06T02:00:00.000Z") };

    expect(getCurrentDashboardProjects([older, newer])).toEqual([newer]);
  });

  it("detects duplicate active projects for the dev warning", () => {
    const duplicates = findDuplicateActiveProjectGroups([
      { ...baseProject, id: "a", updatedAt: new Date("2026-05-06T01:00:00.000Z") },
      { ...baseProject, id: "b", updatedAt: new Date("2026-05-06T02:00:00.000Z") },
      { courseOfferingId: "course-1", studentId: "student-2", id: "c", updatedAt: new Date("2026-05-06T03:00:00.000Z") }
    ]);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].map((project) => project.id)).toEqual(["a", "b"]);
  });
});
