import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("submit button recovery source", () => {
  it("keeps React server action submission without timed reload recovery", () => {
    const source = readFileSync(join(process.cwd(), "src/components/ui/SubmitButton.tsx"), "utf8");
    const draftFormSource = readFileSync(join(process.cwd(), "src/components/ui/StudentRecoverableActionForm.tsx"), "utf8");
    const studentOriginSource = readFileSync(join(process.cwd(), "src/app/student/origin/page.tsx"), "utf8");
    const teacherHomeSource = readFileSync(join(process.cwd(), "src/app/teacher/page.tsx"), "utf8");
    const teacherProposalsSource = readFileSync(join(process.cwd(), "src/app/teacher/proposals/page.tsx"), "utf8");

    expect(source).not.toContain("HTMLFormElement.prototype.submit.call(form)");
    expect(source).toContain("form.reportValidity()");
    expect(source).not.toContain("submitterInput");
    expect(source).not.toContain("SUBMIT_AUTO_RECOVERY_DELAY_MS");
    expect(source).not.toContain("SUBMIT_AUTO_RECOVERY_EVENT");
    expect(source).not.toContain("window.location.reload()");
    expect(source).toContain('type="submit"');
    expect(source).toContain("disabled={disabled || pending}");
    expect(source).toContain("event.preventDefault();");
    expect(draftFormSource).toContain('target.closest(\'button[type="submit"],input[type="submit"]\')');
    expect(draftFormSource).toContain("saveDraft();");
    expect(studentOriginSource).toContain('autoRecovery={false}');
    expect(teacherHomeSource).toContain("<ProposalStartForm");
    expect(teacherProposalsSource).toContain("<ProposalStartForm");
    expect(source).not.toContain("ตรวจสอบสถานะล่าสุด");
  });

  it("returns a typed assignment result before client navigation", () => {
    const teacherActions = readFileSync(join(process.cwd(), "src/app/teacher/actions.ts"), "utf8");
    const openProposalAction = teacherActions.slice(
      teacherActions.indexOf("export async function openProposalScoring"),
      teacherActions.indexOf("export async function reviewAdvisorRequest")
    );

    expect(teacherActions).toContain("openProposalAssignment");
    expect(openProposalAction).not.toContain("revalidatePath(");
    expect(openProposalAction).toContain('code: "proposal_assignment_ready"');
  });

  it("allows Proposal feedback drafts without weakening final score validation", () => {
    const buttonSource = readFileSync(join(process.cwd(), "src/components/ui/SubmitButton.tsx"), "utf8");
    const proposalScoringSource = readFileSync(
      join(process.cwd(), "src/app/teacher/scoring/[assignmentId]/page.tsx"),
      "utf8"
    );

    expect(buttonSource).toContain("formNoValidate?: boolean");
    expect(buttonSource).toContain("formNoValidate={formNoValidate}");
    expect(buttonSource).toContain("!event.currentTarget.formNoValidate");
    expect(proposalScoringSource).toMatch(
      /<SubmitButton[\s\S]*?value="draft"[\s\S]*?formNoValidate[\s\S]*?autoRecovery=\{false\}/
    );
    expect(proposalScoringSource).toMatch(/value="submit"[\s\S]*?scoreGuard/);
  });

  it("preserves teacher score entries before an automatic recovery reload", () => {
    const formSource = readFileSync(join(process.cwd(), "src/components/ui/ProposalDraftForm.tsx"), "utf8");
    const proposalScorePage = readFileSync(join(process.cwd(), "src/app/teacher/scoring/[assignmentId]/page.tsx"), "utf8");
    const typedScorePages = [
      "src/app/teacher/progress1/page.tsx",
      "src/app/teacher/progress2/page.tsx",
      "src/app/teacher/final/page.tsx"
    ].map((path) => readFileSync(join(process.cwd(), path), "utf8"));
    const advisorScorePage = readFileSync(join(process.cwd(), "src/app/teacher/advisor-score/page.tsx"), "utf8");

    expect(formSource).toContain("export function RecoverableActionForm");
    expect(formSource).toContain("sessionStorage.setItem(storageKey");
    expect(formSource).toContain("sessionStorage.removeItem(storageKey)");
    expect(formSource).toContain("clearTimeout(saveTimer.current)");
    expect(formSource).toContain("reconcileTeacherScoreActionResult");
    expect(formSource).toContain("restoreSnapshot: (values, missingFields)");
    expect(formSource).toContain("window.location.reload()");
    expect(formSource).not.toContain("router.refresh()");
    expect(formSource).not.toContain("SUBMIT_AUTO_RECOVERY_EVENT");
    expect(proposalScorePage).toContain("<RecoverableScoreActionForm");
    expect(proposalScorePage).toContain("<SubmitButton");
    expect(proposalScorePage).toContain("${session.user.id}");
    for (const pageSource of typedScorePages) {
      expect(pageSource).toContain("<RecoverableScoreActionForm");
      expect(pageSource).toContain("autoRecovery={false}");
      expect(pageSource).toContain("<SubmitButton");
      expect(pageSource).toContain("${session.user.id}");
    }
    expect(advisorScorePage).toContain("<RecoverableActionForm");
    expect(advisorScorePage).toContain("autoRecovery={false}");
  });
});
