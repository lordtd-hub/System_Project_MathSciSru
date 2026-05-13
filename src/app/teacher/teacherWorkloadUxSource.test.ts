import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("teacher workload UX source", () => {
  it("uses shared workload summary on teacher queue pages", () => {
    const queuePages = [
      "src/app/teacher/schedules/page.tsx",
      "src/app/teacher/proposals/page.tsx",
      "src/app/teacher/progress1/page.tsx",
      "src/app/teacher/progress2/page.tsx",
      "src/app/teacher/final/page.tsx",
      "src/app/teacher/reports/page.tsx",
      "src/app/teacher/advisor-score/page.tsx"
    ];

    for (const pagePath of queuePages) {
      const source = readSource(pagePath);
      expect(source).toContain("TeacherWorkloadSummary");
      expect(source).toContain("ต้องดำเนินการ");
    }
  });

  it("keeps actionable schedule approvals ahead of confirmed calendar content", () => {
    const source = readSource("src/app/teacher/schedules/page.tsx");

    expect(source).toContain('className="panel order-1"');
    expect(source).toContain('className="panel order-3"');
    expect(source).toContain("pendingReviewSchedules");
    expect(source).toContain('approval.teacherId === teacher.id && approval.decision === "PENDING"');
  });

  it("marks report and advisor score queues without changing unlock logic", () => {
    const reports = readSource("src/app/teacher/reports/page.tsx");
    const advisorScore = readSource("src/app/teacher/advisor-score/page.tsx");

    expect(reports).toContain("reportQueueOrder");
    expect(reports).toContain("latestReportHasRevisionRequest");
    expect(reports).toContain("allRequiredReportReviewersPassed");
    expect(advisorScore).toContain("advisorQueueOrder");
    expect(advisorScore).toContain('project.status === "REPORT_APPROVED" || project.status === "ADVISOR_SCORING"');
    expect(advisorScore).toContain('previous?.status === "SUBMITTED"');
  });
});
