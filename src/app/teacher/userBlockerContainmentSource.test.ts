import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("teacher user-blocker containment", () => {
  it("opens Proposal scoring through a typed idempotent action", () => {
    const action = read("src/app/teacher/actions.ts");
    const form = read("src/components/ui/ProposalStartForm.tsx");
    const service = read("src/lib/scoring/openProposalAssignment.ts");

    expect(action).toContain("Promise<ProposalStartActionResult>");
    expect(action).toContain("proposal_start_rate_limited");
    expect(action).toContain("proposal_start_unexpected");
    expect(form).toContain("useActionState");
    expect(form).toContain("router.push");
    expect(service).not.toContain("updateAssignment");
    expect(service).toContain('error.code === "P2002"');
  });

  it("keeps Proposal scoring page loads read-only and handles missing URLs", () => {
    const page = read("src/app/teacher/scoring/[assignmentId]/page.tsx");
    const rubricReader = read("src/lib/rubrics/readProposalConditionRubric.ts");

    expect(page).toContain("readProposalConditionRubric(prisma)");
    expect(page).not.toContain("ensureProposalConditionRubric");
    expect(page).toContain("if (!assignment)");
    expect(page).toContain('href="/teacher/proposals"');
    expect(rubricReader).not.toMatch(/\.create\(|\.update(?:Many)?\(|\.upsert\(/);
  });

  it("keeps every teacher scoring action read-only for rubric configuration", () => {
    const teacherScoringSources = [
      read("src/app/teacher/actions.ts"),
      read("src/app/teacher/scoringActions.ts"),
      read("src/lib/rubrics/readProposalConditionRubric.ts")
    ].join("\n");

    expect(teacherScoringSources).not.toMatch(/rubricItem\.(?:create|update|updateMany|upsert)/);
    expect(teacherScoringSources).not.toMatch(/prisma\.rubric\.(?:create|update|updateMany|upsert)/);
    expect(teacherScoringSources).not.toContain("ensureProgress1Rubric");
    expect(teacherScoringSources).not.toContain("ensureProgress2Rubric");
    expect(teacherScoringSources).not.toContain("ensureFinalRubric");
  });

  it("does not automatically reload pending submit buttons", () => {
    const button = read("src/components/ui/SubmitButton.tsx");
    expect(button).not.toContain("SUBMIT_AUTO_RECOVERY_DELAY_MS");
    expect(button).not.toContain("SUBMIT_AUTO_RECOVERY_EVENT");
    expect(button).not.toContain("window.location.reload()");
  });

  it("provides role-level Thai error boundaries", () => {
    for (const role of ["student", "teacher", "admin"]) {
      expect(read(`src/app/${role}/error.tsx`)).toContain("RoleErrorBoundary");
    }
    expect(read("src/components/ui/RoleErrorBoundary.tsx")).toContain("โหลดหน้านี้ไม่สำเร็จ");
  });
});
