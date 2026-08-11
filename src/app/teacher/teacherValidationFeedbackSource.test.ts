import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const teacherActions = readFileSync(path.join(root, "src/app/teacher/actions.ts"), "utf8");
const feedback = readFileSync(path.join(root, "src/components/ui/ActionFeedback.tsx"), "utf8");
const scoreActionResult = readFileSync(path.join(root, "src/lib/scoring/teacherScoreActionResult.ts"), "utf8");

describe("teacher form validation feedback", () => {
  it("keeps expected teacher form validation failures on the originating page", () => {
    [
      'redirectWithQuery("/teacher/schedules", { error: "schedule_reject_reason_required" })',
      'redirectWithQuery("/teacher/schedules", { error: "schedule_review_decision_invalid" })',
      'status: "validation", code: "proposal_decision_reason_required"',
      'status: "validation", code: "proposal_feedback_required"',
      'redirectWithQuery("/teacher/reports", { error: "report_review_comment_required" })',
      'redirectIfTeacherFormInvalid(errors, "/teacher/progress1")',
      'redirectIfTeacherFormInvalid(errors, "/teacher/progress2")',
      'redirectIfTeacherFormInvalid(errors, "/teacher/advisor-score")',
      'redirectIfTeacherMarkdownInvalid(errors, "/teacher/final")'
    ].forEach((expected) => expect(teacherActions).toContain(expected));
  });

  it("does not throw digest pages for common missing teacher form inputs", () => {
    [
      'throw new Error("กรุณาระบุเหตุผลเมื่อปฏิเสธคำขอที่ปรึกษา")',
      'throw new Error("กรุณาระบุเหตุผลเมื่อไม่อนุมัติวันสอบ")',
      'throw new Error("กรุณาระบุข้อเสนอแนะสำหรับผลการตรวจรายงาน")',
      "throw new Error(errors.join",
      "throw new Error(decisionErrors.join",
      "throw new Error(commentErrors.join"
    ].forEach((unexpected) => expect(teacherActions).not.toContain(unexpected));
  });

  it("has user-facing messages for teacher validation error keys", () => {
    [
      "teacher_text_too_long",
      "teacher_markdown_invalid",
      "teacher_score_invalid",
      "schedule_reject_reason_required",
      "proposal_decision_reason_required",
      "proposal_feedback_required",
      "report_review_comment_required"
    ].forEach((key) => expect(`${feedback}\n${scoreActionResult}`).toContain(key));
  });
});
