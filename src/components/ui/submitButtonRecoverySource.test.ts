import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("submit button recovery source", () => {
  it("uses native form navigation and keeps pending reload as a fallback", () => {
    const source = readFileSync(join(process.cwd(), "src/components/ui/SubmitButton.tsx"), "utf8");
    const draftFormSource = readFileSync(join(process.cwd(), "src/components/ui/ProposalDraftForm.tsx"), "utf8");
    const studentOriginSource = readFileSync(join(process.cwd(), "src/app/student/origin/page.tsx"), "utf8");
    const teacherHomeSource = readFileSync(join(process.cwd(), "src/app/teacher/page.tsx"), "utf8");
    const teacherProposalsSource = readFileSync(join(process.cwd(), "src/app/teacher/proposals/page.tsx"), "utf8");

    expect(source).toContain("HTMLFormElement.prototype.submit.call(form)");
    expect(source).toContain("form.reportValidity()");
    expect(source).toContain('submitterInput.name = name');
    expect(source).toContain('submitterInput.value = value ?? ""');
    expect(source).toContain("SUBMIT_AUTO_RECOVERY_DELAY_MS = 15_000");
    expect(source).toContain("window.setTimeout(() => window.location.reload(), SUBMIT_AUTO_RECOVERY_DELAY_MS)");
    expect(source).toContain("() => window.location.replace(window.location.href)");
    expect(source).toContain('type="submit"');
    expect(source).toContain("disabled={disabled || pending}");
    expect(draftFormSource).toContain('target.closest(\'button[type="submit"],input[type="submit"]\')');
    expect(draftFormSource).toContain("saveDraft();");
    expect(studentOriginSource).toContain('<SubmitButton pendingText="กำลังบันทึกและส่ง...">');
    expect(teacherHomeSource).toContain('<SubmitButton pendingText="กำลังเปิดแบบประเมิน...">');
    expect(teacherProposalsSource).toContain('<SubmitButton pendingText="กำลังเปิดแบบประเมิน...">');
    expect(source).not.toContain("ตรวจสอบสถานะล่าสุด");
  });
});
