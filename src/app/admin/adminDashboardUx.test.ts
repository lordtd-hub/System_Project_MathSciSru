import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin dashboard duplicate and batch round UX", () => {
  const pageSource = readFileSync(join(process.cwd(), "src/app/admin/page.tsx"), "utf8");

  it("shows current dashboard projects after duplicate filtering", () => {
    expect(pageSource).toContain("getCurrentDashboardProjects(rawProjects)");
    expect(pageSource).toContain("findDuplicateActiveProjectGroups(rawProjects)");
  });

  it("keeps advisor-score waiting in passive tracking with a status link", () => {
    const primaryCandidates = pageSource.slice(pageSource.indexOf("const nextActionProjects"), pageSource.indexOf("const nextAction ="));
    const tracking = pageSource.slice(pageSource.indexOf('<DashboardSectionHeader title="งานที่ต้องติดตาม"'), pageSource.indexOf("{failAlertCount ? (", pageSource.indexOf("<NextActionCard")));

    expect(primaryCandidates).not.toContain("REPORT_APPROVED");
    expect(tracking).toContain("รายงานผ่านแล้ว รอคะแนนอาจารย์ที่ปรึกษา");
    expect(tracking).toContain('countFromStatus(statusCounts, "REPORT_APPROVED")');
    expect(tracking).toContain('href="/admin/closeout">ดูสถานะ</Link>');
    expect(tracking).not.toContain("ดำเนินการ");
  });

  it("uses the closeout service eligibility for primary candidates and ready metrics", () => {
    expect(pageSource).toContain("getCompletionEligibility(project.id)");
    expect(pageSource).toContain("eligibilities.filter((eligibility) => eligibility.eligible).length");
    expect(pageSource).toContain('readyCloseoutCount ? [{ status: "ADVISOR_SCORING" as const, completionEligible: true }] : []');
    expect(pageSource).toContain('label: "พร้อมยืนยันจบโครงงาน", value: readyCloseoutCount');
    expect(pageSource).not.toContain('count: countFromStatus(statusCounts, "ADVISOR_SCORING")');
  });

  it("surfaces course-level assessment round cards", () => {
    expect(pageSource).toContain("รอบสอบของรายวิชา");
    expect(pageSource).toContain("courseLevelRoundTypes");
    expect(pageSource).toContain('href: "/admin/rounds"');
    expect(pageSource).toContain("openCourseRound");
  });

  it("surfaces a current-round focus panel for admin workflow priority", () => {
    expect(pageSource).toContain("deriveAdminCurrentRoundFocus");
    expect(pageSource).toContain("รอบสอบที่ต้องติดตาม");
    expect(pageSource).toContain("roundFocus.items.map");
    expect(pageSource).toContain('href: "/admin/schedules"');
    expect(pageSource).toContain('href: "/admin/closeout"');
  });

  it("shows a compact development duplicate warning with the reset command", () => {
    expect(pageSource).toContain("พบข้อมูล demo ซ้ำ");
    expect(pageSource).toContain("cmd /c npm.cmd run dev:reset-demo");
  });

  it("keeps destructive testing cleanup behind an explicit testing mode gate", () => {
    expect(pageSource).toContain("isAdminTestingToolsEnabled");
    expect(pageSource).toContain("resetCourseOfferingTestData");
    expect(pageSource).toContain("โหมดทดสอบ:");
    expect(pageSource).toContain("ล้างข้อมูลทดสอบรายวิชานี้");
  });
});
