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
    expect(teacherPage).toContain("การแจ้งเตือน");
    expect(timelineCard).toContain("ประวัติหลักฐาน");
    expect(scoringPage).toContain("ข้อควรพิจารณาในรายการสำคัญ");
    expect(adminPage).not.toContain("Project status overview");
    expect(teacherPage).not.toContain(">Notification<");
    expect(timelineCard).not.toContain("Evidence trail");
    expect(scoringPage).not.toContain("Critical item warnings");
  });
});
