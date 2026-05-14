import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("student readability stabilization", () => {
  it("adds a shared student summary module for action, waiting, done, and locked states", () => {
    const component = source("src/components/ui/StudentReadabilitySummary.tsx");

    expect(component).toContain("student-readability-summary");
    expect(component).toContain('"action" | "waiting" | "done" | "locked" | "info"');
  });

  it("keeps the schedule page from looking shell-only after evidence save and summarizes next actions", () => {
    const page = source("src/app/student/schedule/page.tsx");

    expect(page).toContain("StudentReadabilitySummary");
    expect(page).toContain("สรุปสถานะการสอบของฉัน");
    expect(page).toContain("ต้องทำตอนนี้");
    expect(page).toContain("รอกรรมการ");
    expect(page).toContain("ล็อก/ยังไม่พร้อม");
    expect(page).toContain('params.success === "assessment_evidence_saved"');
    expect(page).toContain("student-schedule-page-content");
  });

  it("summarizes project-origin work before the long advisor request form", () => {
    const page = source("src/app/student/project/page.tsx");

    expect(page).toContain("StudentReadabilitySummary");
    expect(page).toContain("สรุปสถานะหัวข้อและที่ปรึกษา");
    expect(page).toContain("ต้องทำตอนนี้");
    expect(page).toContain("รออาจารย์");
    expect(page).toContain("อนุมัติแล้ว");
    expect(page).toContain("saveProjectOrigin");
  });

  it("summarizes Proposal next-action state before the long submission form", () => {
    const page = source("src/app/student/proposal/page.tsx");

    expect(page).toContain("StudentReadabilitySummary");
    expect(page).toContain("สรุปสถานะ Proposal");
    expect(page).toContain("รอรอบ/รออนุญาต");
    expect(page).toContain("proposalComments.length");
    expect(page).toContain("proposalVoteLabel");
    expect(page).toContain("saveProposalSubmission");
    expect(page).not.toContain("{vote.vote}");
  });

  it("does not expose raw committee role enum labels on the student dashboard", () => {
    const page = source("src/app/student/page.tsx");

    expect(page).toContain("committeeRoleLabel");
    expect(page).toContain("committeeRoleLabel(assignment.role)");
    expect(page).not.toContain(">{assignment.role}</span>");
  });

  it("separates report actions from waiting-for-review states and avoids raw PASS wording", () => {
    const page = source("src/app/student/report/page.tsx");

    expect(page).toContain("StudentReadabilitySummary");
    expect(page).toContain("สรุปสถานะรายงาน");
    expect(page).toContain("รอผู้ตรวจ");
    expect(page).toContain("ผ่านการตรวจ");
    expect(page).not.toContain('? "PASS" :');
  });

  it("marks feedback as read-only and separates published results from pending scores", () => {
    const page = source("src/app/student/feedback/page.tsx");

    expect(page).toContain("PageHeader");
    expect(page).toContain("StudentReadabilitySummary");
    expect(page).toContain("ไม่ใช่งานที่นักศึกษาต้องส่งเพิ่ม");
    expect(page).toContain("อ่านอย่างเดียว");
    expect(page).toContain("รอคะแนน");
  });
});
