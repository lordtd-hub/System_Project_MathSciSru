import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin round exception UX", () => {
  const exceptionsPage = readFileSync(join(process.cwd(), "src/app/admin/round-exceptions/page.tsx"), "utf8");
  const roundsPage = readFileSync(join(process.cwd(), "src/app/admin/rounds/page.tsx"), "utf8");
  const actionsSource = readFileSync(join(process.cwd(), "src/app/admin/actions.ts"), "utf8");

  it("moves long late-submission forms out of the rounds overview", () => {
    expect(roundsPage).toContain("/admin/round-exceptions?round_type=PROPOSAL");
    expect(roundsPage).toContain("จัดการผู้ส่งย้อนหลัง");
    expect(roundsPage).not.toContain("missingProposalProjects.map((project)");
  });

  it("renders a searchable list page for missed and late round cases", () => {
    expect(exceptionsPage).toContain("จัดการผู้ส่งย้อนหลัง / นักศึกษาที่พลาดรอบ");
    expect(exceptionsPage).toContain('name="status"');
    expect(exceptionsPage).toContain('name="q"');
    expect(exceptionsPage).toContain("<table");
    expect(exceptionsPage).toContain("เปิดส่งรายกรณี");
  });

  it("keeps late-open actions scoped and redirects back to the exception list when used there", () => {
    expect(exceptionsPage).toContain('name="return_to" value="/admin/round-exceptions"');
    expect(actionsSource).toContain('returnTo === "/admin/round-exceptions"');
    expect(actionsSource).toContain('revalidatePath("/admin/round-exceptions")');
  });

  it("surfaces non-Proposal eligible-but-incomplete projects for recovery without counting not-yet-eligible projects", () => {
    expect(exceptionsPage).toContain("getRoundEligibility");
    expect(exceptionsPage).toContain("eligibleButIncomplete");
    expect(exceptionsPage).toContain("eligibleIncompleteProjectIds");
    expect(exceptionsPage).toContain('selectedRoundType !== "PROPOSAL"');
    expect(exceptionsPage).toContain('!(selectedRoundType === "PROPOSAL" && hasSubmission)');
  });

  it("keeps a permanent dashboard shortcut and rounds header entry behind Admin guards", () => {
    const dashboard = readFileSync(join(process.cwd(), "src/app/admin/page.tsx"), "utf8");
    const dashboardShortcut = '{ title: "เปิดส่งย้อนหลังรายกรณี",';
    expect(dashboard).toContain(dashboardShortcut);
    expect(dashboard.indexOf("if (isNotAdmin)")).toBeLessThan(dashboard.indexOf(dashboardShortcut));
    expect(dashboard).toContain('session?.user.role !== "ADMIN"');
    expect(roundsPage).toContain('actions={<a className="button-secondary" href="/admin/round-exceptions">เปิดส่งย้อนหลังรายกรณี</a>}');
    for (const page of [roundsPage, exceptionsPage]) {
      expect(page).toContain('if (session?.user.role !== "ADMIN") return');
      expect(page.indexOf('if (session?.user.role !== "ADMIN")')).toBeLessThan(page.indexOf("prisma.courseOffering"));
    }
  });

  it("offers a round-specific entry for every round before any Proposal-only warning", () => {
    const roundCards = roundsPage.slice(roundsPage.indexOf("{courseLevelRoundTypes.map((roundType) => {"));
    const entry = roundCards.indexOf('href={`/admin/round-exceptions?round_type=${roundType}`}');
    expect(entry).toBeGreaterThan(0);
    expect(entry).toBeLessThan(roundCards.indexOf("{requireProposalCloseAck ? ("));
    expect(roundCards.slice(roundCards.indexOf("</dl>"), entry)).not.toMatch(/\?\s*\(/);
    expect(roundCards).toContain('aria-label={`เปิดส่งย้อนหลังรายกรณี: ${roundTypeLabelTh(roundType)}`}');
    const roundTypes = readFileSync(join(process.cwd(), "src/lib/assessments/courseRounds.ts"), "utf8");
    expect(roundTypes).toContain('["PROPOSAL", "PROGRESS_1", "PROGRESS_2", "FINAL_PRESENTATION"]');
  });


  it("preserves the selected round on both explicit late-open redirects", () => {
    const action = actionsSource.slice(actionsSource.indexOf("export async function openLateRoundSubmissionForProject("), actionsSource.indexOf("export async function openCourseRound("));
    expect(action).toContain('const redirectParams = { round_type: returnTo === "/admin/round-exceptions" ? roundType : undefined };');
    expect(action).toContain('redirectWithQuery(redirectPath, { ...redirectParams, error: "late_round_requires_closed_round" })');
    expect(action).toContain('redirectWithQuery(redirectPath, { ...redirectParams, success: "late_round_opened" })');
    expect(action.match(/redirectWithQuery\(/g)).toHaveLength(2);
  });

  it("displays excused penalties using the same exception type as the mutation", () => {
    expect(exceptionsPage).toContain('import { LATE_ROUND_EXCUSED_EXCEPTION_TYPE } from "@/lib/assessments/roundExceptions"');
    expect(exceptionsPage).toContain('latestException?.exceptionType === LATE_ROUND_EXCUSED_EXCEPTION_TYPE');
    expect(exceptionsPage).not.toContain('"LATE_ROUND_EXCUSED"');
    expect(actionsSource).toContain('excused ? LATE_ROUND_EXCUSED_EXCEPTION_TYPE : LATE_ROUND_EXCEPTION_TYPE');
  });

});
