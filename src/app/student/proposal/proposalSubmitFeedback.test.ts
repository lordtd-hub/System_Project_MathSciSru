import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("student Proposal submit feedback wiring", () => {
  const page = readFileSync(join(process.cwd(), "src/app/student/proposal/page.tsx"), "utf8");

  it("shows typed outcomes beside the sticky submit action", () => {
    const stickyAction = page.slice(page.indexOf('<div className="sticky bottom-0'), page.indexOf("</FormSection>"));
    expect(stickyAction).toContain("<StudentActionFeedback");
    expect(stickyAction).toContain('successTitle=');
    expect(stickyAction).toContain('successNextStep=');
    expect(stickyAction).toContain("<SubmitButton");
  });

  it("uses the shared general Re-proposal copy without hard-coded attempt numbers", () => {
    expect(page).toContain("getProposalStudentNextAction");
    expect(page).toContain("พร้อมส่ง Proposal สำหรับการสอบหัวข้อครั้งถัดไป");
    expect(page).toContain("กรอกและส่ง Proposal ฉบับใหม่");
    expect(page).not.toContain("ส่ง Proposal สำหรับ Re-proposal");
  });
  it("navigates successful submissions to the refreshed submitted summary", () => {
    expect(page).toContain('successHref="/student/proposal?success=proposal_submitted#student-proposal-submitted-summary"');
    expect(page).toContain('id="student-proposal-submitted-summary"');
    expect(page).toContain('data-testid="student-proposal-submitted-summary"');
    expect(page).toContain("ระบบบันทึกฉบับแก้ไขแล้ว ขั้นตอนถัดไปคือรออาจารย์ที่ปรึกษาตรวจและรับรอง");
  });
});
