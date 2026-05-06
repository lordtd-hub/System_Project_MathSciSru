import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin dashboard duplicate and batch round UX", () => {
  const pageSource = readFileSync(join(process.cwd(), "src/app/admin/page.tsx"), "utf8");

  it("shows current dashboard projects after duplicate filtering", () => {
    expect(pageSource).toContain("getCurrentDashboardProjects(rawProjects)");
    expect(pageSource).toContain("findDuplicateActiveProjectGroups(rawProjects)");
  });

  it("surfaces course-level assessment round cards", () => {
    expect(pageSource).toContain("รอบสอบของรายวิชา");
    expect(pageSource).toContain("courseLevelRoundTypes");
    expect(pageSource).toContain('href: "/admin/rounds"');
    expect(pageSource).toContain("openCourseRound");
  });

  it("shows a compact development duplicate warning with the reset command", () => {
    expect(pageSource).toContain("พบข้อมูล demo ซ้ำ");
    expect(pageSource).toContain("cmd /c npm.cmd run dev:reset-demo");
  });

  it("keeps destructive testing cleanup behind an explicit testing mode gate", () => {
    expect(pageSource).toContain("isAdminTestingToolsEnabled");
    expect(pageSource).toContain("resetCourseOfferingTestData");
    expect(pageSource).toContain("ล้างข้อมูลทดสอบรายวิชานี้");
  });
});
