import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("project record source", () => {
  it("keeps project record read-only and access checked", () => {
    const page = readFileSync("src/app/projects/[projectId]/page.tsx", "utf8");
    const service = readFileSync("src/lib/projects/projectRecord.ts", "utf8");

    expect(page).toContain("getProjectRecordForViewer(projectId, session?.user)");
    expect(page).not.toContain("<form");
    expect(page).not.toContain("action={");
    expect(service).toContain("canViewProjectRecord");
    expect(service).toContain('roles.has("ADMIN")');
    expect(service).toContain('roles.has("STUDENT")');
    expect(service).toContain('roles.has("TEACHER")');
  });

  it("adds project record links without replacing existing workflow routes", () => {
    const studentDashboard = readFileSync("src/app/student/page.tsx", "utf8");
    const studentProposal = readFileSync("src/app/student/proposal/page.tsx", "utf8");
    const studentSchedule = readFileSync("src/app/student/schedule/page.tsx", "utf8");
    const studentReport = readFileSync("src/app/student/report/page.tsx", "utf8");
    const teacherDashboard = readFileSync("src/app/teacher/page.tsx", "utf8");
    const teacherSchedules = readFileSync("src/app/teacher/schedules/page.tsx", "utf8");
    const adminDashboard = readFileSync("src/app/admin/page.tsx", "utf8");

    for (const source of [studentDashboard, studentProposal, studentSchedule, studentReport]) {
      expect(source).toContain("ดูแฟ้มโครงงาน");
      expect(source).toContain("`/projects/${project.id}`");
    }

    expect(teacherDashboard).toContain("`/projects/${attempt.project.id}`");
    expect(teacherDashboard).toContain("/teacher/scoring/");
    expect(teacherSchedules).toContain("`/projects/${schedule.project.id}`");
    expect(adminDashboard).toContain("`/projects/${project.id}`");
    expect(adminDashboard).toContain("confirmProjectAdvisor");
  });
});
