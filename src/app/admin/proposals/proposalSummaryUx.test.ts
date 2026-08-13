import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin proposal summary UX", () => {
  const pageSource = readFileSync(join(process.cwd(), "src/app/admin/proposals/page.tsx"), "utf8");
  const decisionFormSource = readFileSync(
    join(process.cwd(), "src/components/ui/AdminProposalDecisionForm.tsx"),
    "utf8"
  );
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

  it("does not preselect PASS and explains each decision before submission", () => {
    expect(decisionFormSource).toContain('<option value="" disabled>เลือกมติสุดท้าย</option>');
    expect(decisionFormSource).toContain("disabled={!decision}");
    expect(decisionFormSource).toContain("proposalDecisionGuidance(decision)");
    expect(pageSource).not.toContain('defaultValue={finalDecision ?? "PASS"}');
  });

  it("uses unique responsive form instances and hides server-forbidden edits", () => {
    expect(pageSource).toContain('formInstance="mobile"');
    expect(pageSource).toContain('formInstance="desktop"');
    expect(decisionFormSource).toContain("`${formInstance}-${attemptId.replace");
    expect(pageSource).toContain("proposalDecisionEditBlockReason");
    expect(pageSource).toContain("มติถูกล็อกแล้ว");
  });

  it("groups the desktop decision workspace into three scan-friendly columns", () => {
    expect(pageSource).toContain("<th>โครงการ</th>");
    expect(pageSource).toContain("<th>ผลประเมิน</th>");
    expect(pageSource).toContain("<th>มติและขั้นตอนถัดไป</th>");
    expect(pageSource).toContain("ดูคะแนนและข้อเสนอแนะรายคน");
  });

  it("only offers feedback release after a final decision and asks for confirmation", () => {
    expect(pageSource).toContain("isLatestAttempt && attempt.proposalResult");
    expect(pageSource).toContain("ยืนยันเปิดข้อเสนอแนะของ");
  });

  it("finishes feedback release through a typed action result instead of redirecting", () => {
    expect(pageSource).toContain("<ProposalLifecycleActionForm action={releaseFeedback}");
    expect(pageSource).toContain('pendingText="กำลังเปิดข้อเสนอแนะ..."');
    expect(actionSource).toContain('runProposalLifecycleAction("admin.releaseFeedback"');
    expect(actionSource).toContain('code: "PROPOSAL_FEEDBACK_RELEASED"');
    expect(actionSource).toContain('unchanged: outcome === "unchanged"');
    expect(actionSource).not.toContain('redirect("/admin/proposals?success=feedback_released")');
  });
});
