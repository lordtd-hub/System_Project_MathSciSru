import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(join(process.cwd(), "src/app/teacher/advicees/page.tsx"), "utf8");

describe("teacher advicees page source", () => {
  it("lists only projects where the current teacher is an advisor", () => {
    const page = source();

    expect(page).toContain("advisorTeacherId: teacher.id");
    expect(page).toContain('status: "APPROVED"');
    expect(page).toContain('role: "ADVISOR"');
    expect(page).toContain("hasApprovedTeacherCapability");
  });

  it("is read-only and links each advicee project to the project record", () => {
    const page = source();

    expect(page).toContain("ดูแฟ้มโครงงาน");
    expect(page).toContain("href={`/projects/${project.id}`}");
    expect(page).toContain("profile: true");
    expect(page).toContain("ช่องทางติดต่อ");
    expect(page).toContain("project.student.profile?.phone");
    expect(page).toContain("project.student.profile?.lineId");
    expect(page).not.toContain("<form");
  });
});
