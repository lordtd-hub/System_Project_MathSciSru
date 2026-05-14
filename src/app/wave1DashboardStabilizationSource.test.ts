import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("wave 1 dashboard stabilization source", () => {
  it("keeps dashboard terminology Thai-facing and marks legacy QA context", () => {
    const adminPage = readFileSync("src/app/admin/page.tsx", "utf8");
    const teacherPage = readFileSync("src/app/teacher/page.tsx", "utf8");
    const timelineCard = readFileSync("src/components/ui/TimelineCard.tsx", "utf8");
    const scoringPage = readFileSync("src/app/teacher/scoring/[assignmentId]/page.tsx", "utf8");

    expect(adminPage).toContain("ภาพรวมสถานะโครงงาน");
    expect(adminPage).toContain("การแจ้งเตือนที่ต้องติดตาม");
    expect(adminPage).toContain("Legacy QA");
    expect(teacherPage).not.toContain("การแจ้งเตือน");
    expect(teacherPage).not.toContain("prisma.notification.findMany");
    expect(timelineCard).toContain("ประวัติหลักฐาน");
    expect(scoringPage).toContain("ข้อควรพิจารณาในรายการสำคัญ");
    expect(adminPage).not.toContain("Project status overview");
    expect(teacherPage).not.toContain(">Notification<");
    expect(timelineCard).not.toContain("Evidence trail");
    expect(scoringPage).not.toContain("Critical item warnings");
  });

  it("keeps Wave 1 schedule and role status display stable", () => {
    const studentPage = readFileSync("src/app/student/page.tsx", "utf8");
    const studentSchedulePage = readFileSync("src/app/student/schedule/page.tsx", "utf8");
    const teacherPage = readFileSync("src/app/teacher/page.tsx", "utf8");
    const teacherSchedulesPage = readFileSync("src/app/teacher/schedules/page.tsx", "utf8");
    const adminSchedulesPage = readFileSync("src/app/admin/schedules/page.tsx", "utf8");

    expect(studentPage).toContain("studentWorkflowContext");
    expect(studentPage).toContain("roundAwareNextAssessmentAction");
    expect(studentPage).toContain("displayStudentTrackingTasks");
    expect(studentSchedulePage).toContain("roundOpen");
    expect(studentSchedulePage).toContain("getAssessmentCardState(");
    expect(teacherPage).toContain("Array.from(new Set");
    expect(teacherPage).toContain("teacherRoleBadgeLabel");
    expect(teacherSchedulesPage).toContain('orderBy: [{ createdAt: "asc" }, { proposedStartAt: "asc" }]');
    expect(adminSchedulesPage).toContain('orderBy: [{ createdAt: "asc" }, { proposedStartAt: "asc" }]');
  });

  it("keeps long evidence sections scrollable instead of stretching dashboards", () => {
    const globals = readFileSync("src/app/globals.css", "utf8");
    const timelineCard = readFileSync("src/components/ui/TimelineCard.tsx", "utf8");
    const projectRecordPage = readFileSync("src/app/projects/[projectId]/page.tsx", "utf8");
    const adminEvidencePage = readFileSync("src/app/admin/evidence/page.tsx", "utf8");

    expect(globals).toContain(".evidence-scroll-panel");
    expect(globals).toContain("max-h-[24rem]");
    expect(globals).toContain(".evidence-scroll-panel-tight");
    expect(timelineCard).toContain("evidence-scroll-panel");
    expect(projectRecordPage).toContain("evidence-scroll-panel space-y-2");
    expect(adminEvidencePage).toContain("evidence-scroll-panel-tight mt-3 space-y-2 text-sm");
  });
});
