import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("submit button recovery source", () => {
  it("keeps React server action submission and pending reload recovery", () => {
    const source = readFileSync(join(process.cwd(), "src/components/ui/SubmitButton.tsx"), "utf8");
    const draftFormSource = readFileSync(join(process.cwd(), "src/components/ui/ProposalDraftForm.tsx"), "utf8");
    const studentOriginSource = readFileSync(join(process.cwd(), "src/app/student/origin/page.tsx"), "utf8");
    const teacherHomeSource = readFileSync(join(process.cwd(), "src/app/teacher/page.tsx"), "utf8");
    const teacherProposalsSource = readFileSync(join(process.cwd(), "src/app/teacher/proposals/page.tsx"), "utf8");

    expect(source).not.toContain("HTMLFormElement.prototype.submit.call(form)");
    expect(source).toContain("form.reportValidity()");
    expect(source).not.toContain("submitterInput");
    expect(source).toContain("SUBMIT_AUTO_RECOVERY_DELAY_MS = 15_000");
    expect(source).toContain("window.setTimeout(() => window.location.reload(), SUBMIT_AUTO_RECOVERY_DELAY_MS)");
    expect(source).toContain('type="submit"');
    expect(source).toContain("disabled={disabled || pending}");
    expect(source).toContain("event.preventDefault();");
    expect(draftFormSource).toContain('target.closest(\'button[type="submit"],input[type="submit"]\')');
    expect(draftFormSource).toContain("saveDraft();");
    expect(studentOriginSource).toContain('<SubmitButton pendingText="กำลังบันทึกและส่ง...">');
    expect(teacherHomeSource).toContain('<SubmitButton pendingText="กำลังเปิดแบบประเมิน...">');
    expect(teacherProposalsSource).toContain('<SubmitButton pendingText="กำลังเปิดแบบประเมิน...">');
    expect(source).not.toContain("ตรวจสอบสถานะล่าสุด");
  });

  it("redirects a newly opened Proposal assignment to its scoring page", () => {
    const teacherActions = readFileSync(join(process.cwd(), "src/app/teacher/actions.ts"), "utf8");

    expect(teacherActions).toContain("const assignment = await prisma.evaluatorAssignment.upsert");
    expect(teacherActions).toContain('revalidatePath("/teacher/proposals")');
    expect(teacherActions).toContain('redirect(`/teacher/scoring/${encodeURIComponent(assignment.id)}`)');
  });
});
