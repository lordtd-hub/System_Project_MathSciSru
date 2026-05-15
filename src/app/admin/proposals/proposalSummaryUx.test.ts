import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin proposal summary UX", () => {
  const pageSource = readFileSync(join(process.cwd(), "src/app/admin/proposals/page.tsx"), "utf8");
  const actionSource = readFileSync(join(process.cwd(), "src/app/admin/actions.ts"), "utf8");

  it("keeps teacher claims out of the proposal summary page", () => {
    expect(pageSource).not.toContain("TeacherAccountClaim");
    expect(pageSource).not.toContain("teacherAccountClaim");
    expect(pageSource).not.toContain("/admin/claims");
  });

  it("shows visible success and disabled closed-round states", () => {
    expect(pageSource).toContain("ActionFeedback");
    expect(actionSource).toContain("proposal_round_closed");
    expect(pageSource).toContain("ปิดรอบแล้ว");
    expect(pageSource).toContain("disabled={closed}");
  });

  it("uses explicit closedAt and closedBy fields instead of updatedAt for closed timestamp", () => {
    expect(actionSource).toContain("buildCloseAssessmentRoundData(adminUserId, round.roundType)");
    expect(actionSource).toContain("isRoundClosed(round.status)");
    expect(pageSource).toContain("round.closedAt");
    expect(pageSource).toContain("closedByAdmin");
    expect(pageSource).not.toContain("round.updatedAt.toLocaleString");
  });

  it("uses explicit final decision labels and next-step guidance", () => {
    expect(pageSource).toContain("บันทึกผลการตัดสิน");
    expect(pageSource).toContain("ขั้นถัดไป: แต่งตั้งประธานกรรมการและกรรมการ");
    expect(pageSource).toContain("เวลาบันทึก");
    expect(pageSource).not.toContain("decided_at:");
  });
});
