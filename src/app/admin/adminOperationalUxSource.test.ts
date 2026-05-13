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
    expect(source).toContain("การปิดหรือรีเซตรอบ");
  });

  it("separates closeout actions from waiting and completed projects", () => {
    const source = readSource("src/app/admin/closeout/page.tsx");

    expect(source).toContain("readyToClose");
    expect(source).toContain("waitingAdvisorScore");
    expect(source).toContain("AdminQueueSection");
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
  });

  it("clarifies evidence exports including grade summary meaning", () => {
    const source = readSource("src/app/admin/evidence/page.tsx");

    expect(source).toContain('kind: "grades"');
    expect(source).toContain("คะแนนแต่ละรอบและสถานะจบรายคน");
    expect(source).toContain("ไม่เปลี่ยนกฎการปิดโครงงานหรือการคำนวณคะแนน");
  });
});
