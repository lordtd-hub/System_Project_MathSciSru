import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("admin operational UX source", () => {
  it("uses admin operational summaries on scale-sensitive admin pages", () => {
    const pagePaths = [
      "src/app/admin/rounds/page.tsx",
      "src/app/admin/closeout/page.tsx",
      "src/app/admin/proposals/page.tsx",
      "src/app/admin/schedules/page.tsx",
      "src/app/admin/evidence/page.tsx"
    ];

    for (const pagePath of pagePaths) {
      const source = readSource(pagePath);
      expect(source).toContain("AdminOperationalSummary");
    }
  });

  it("keeps round eligibility logic read-only while separating dangerous round actions", () => {
    const source = readSource("src/app/admin/rounds/page.tsx");

    expect(source).toContain("getRoundEligibility");
    expect(source).toContain("eligibleButIncomplete");
    expect(source).toContain("notReady");
    expect(source).toContain("AdminDangerZone");
    expect(source).toContain("getUiMode");
    expect(source).toContain("figma-admin-rounds");
    expect(source).toContain("FigmaStatusBadge");
    expect(source).toContain("การปิดหรือรีเซตรอบ");
  });

  it("separates closeout actions from waiting and completed projects", () => {
    const source = readSource("src/app/admin/closeout/page.tsx");

    expect(source).toContain("readyToClose");
    expect(source).toContain("waitingAdvisorScore");
    expect(source).toContain("AdminQueueSection");
    expect(source).toContain("figma-admin-closeout");
    expect(source).toContain("FigmaCloseoutCard");
    expect(source).toContain("Needs admin action");
    expect(source).toContain("Waiting");
    expect(source).toContain("Completed");
  });

  it("groups admin schedules by actionable status without changing approval queries", () => {
    const source = readSource("src/app/admin/schedules/page.tsx");

    expect(source).toContain('schedule.status === "PROPOSED"');
    expect(source).toContain('schedule.status === "REJECTED"');
    expect(source).toContain('schedule.status === "CONFIRMED"');
    expect(source).toContain('approval.decision === "PENDING"');
    expect(source).toContain("scheduleGroups");
    expect(source).toContain("figma-admin-schedules");
    expect(source).toContain("FigmaStatusBadge");
  });

  it("clarifies evidence exports including grade summary meaning", () => {
    const source = readSource("src/app/admin/evidence/page.tsx");

    expect(source).toContain('kind: "grades"');
    expect(source).toContain("figma-admin-evidence");
    expect(source).toContain("grade CSV");
    expect(source).toContain("คะแนนแต่ละรอบและสถานะจบรายคน");
    expect(source).toContain("ไม่เปลี่ยนกฎการปิดโครงงานหรือการคำนวณคะแนน");
  });
  it("adds a safe Figma proposal renderer while preserving proposal actions", () => {
    const source = readSource("src/app/admin/proposals/page.tsx");

    expect(source).toContain("getUiMode");
    expect(source).toContain("figma-admin-proposals");
    expect(source).toContain("FigmaReviewLayout");
    expect(source).toContain("FigmaStatusBadge");
    expect(source).toContain("saveFinalDecision");
    expect(source).toContain("releaseFeedback");
    expect(source).toContain("closeProposalRound");
    expect(source).toContain('name="final_decision"');
    expect(source).toContain('name="final_decision_reason"');
    expect(source).toContain('name="acknowledge_missing_projects"');
  });
});
