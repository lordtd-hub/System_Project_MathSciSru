import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const teacherActions = readFileSync(path.join(root, "src/app/teacher/actions.ts"), "utf8");
const feedback = readFileSync(path.join(root, "src/components/ui/ActionFeedback.tsx"), "utf8");

describe("teacher advisor request validation feedback", () => {
  it("redirects expected advisor request form validation errors instead of throwing digest pages", () => {
    expect(teacherActions).toContain('redirectWithQuery("/teacher/advisor-requests", { error: "advisor_request_comment_too_long" })');
    expect(teacherActions).toContain('redirectWithQuery("/teacher/advisor-requests", { error: "advisor_request_decision_invalid" })');
    expect(teacherActions).toContain('redirectWithQuery("/teacher/advisor-requests", { error: "advisor_reject_reason_required" })');
    expect(teacherActions).not.toContain('throw new Error("กรุณาระบุเหตุผลเมื่อปฏิเสธคำขอที่ปรึกษา")');
  });

  it("has user-facing messages for advisor request validation errors", () => {
    expect(feedback).toContain("advisor_request_comment_too_long");
    expect(feedback).toContain("advisor_request_decision_invalid");
    expect(feedback).toContain("advisor_reject_reason_required");
  });
});
