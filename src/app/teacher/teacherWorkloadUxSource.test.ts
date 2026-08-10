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

  it("keeps teacher workload surfaces compact, action-first, and mobile-aware", () => {
    const component = readSource("src/components/ui/TeacherWorkloadQueue.tsx");
    const css = readSource("src/app/globals.css");

    expect(component).toContain("teacher-workload-summary");
    expect(component).toContain("teacher-workload-total");
    expect(component).toContain("teacher-compact-queue-list");
    expect(component).toContain("data-queue-tone");
    expect(component).toContain('metric.tone === "action"');
    expect(css).toContain(".teacher-workload-summary");
    expect(css).toContain(".teacher-compact-queue-item");
    expect(css).toContain(".teacher-scroll-list");
    expect(css).toContain(".teacher-compact-badge-stack");
    expect(css).toContain(".teacher-review-card");
    expect(css).toContain("@media (max-width: 640px)");
  });

  it("uses a shared teacher review-card surface on long detail pages", () => {
    const detailPages = [
      "src/app/teacher/proposals/page.tsx",
      "src/app/teacher/schedules/page.tsx",
      "src/app/teacher/progress1/page.tsx",
      "src/app/teacher/progress2/page.tsx",
      "src/app/teacher/final/page.tsx",
      "src/app/teacher/reports/page.tsx",
      "src/app/teacher/advisor-score/page.tsx"
    ];

    for (const pagePath of detailPages) {
      expect(readSource(pagePath)).toContain("teacher-review-card");
    }
  });

  it("keeps actionable schedule approvals ahead of confirmed calendar content", () => {
    const source = readSource("src/app/teacher/schedules/page.tsx");

    expect(source).toContain('className="panel order-1"');
    expect(source).toContain('className="panel order-3"');
    expect(source).toContain("pendingReviewSchedules");
    expect(source).toContain("waitingSchedules");
    expect(source).toContain("returnedSchedules");
    expect(source).toContain("TeacherCompactQueueList");
    expect(source).toContain("teacher-scroll-list");
    expect(source).toContain("คิวอนุมัติวันสอบ");
    expect(source).toContain('approval.teacherId === teacher.id && approval.decision === "PENDING"');
  });

  it("adds compact proposal navigation before long proposal review cards", () => {
    const source = readSource("src/app/teacher/proposals/page.tsx");

    expect(source).toContain("TeacherCompactQueueList");
    expect(source).toContain("pendingAttempts.map");
    expect(source).toContain('href: `#proposal-${attempt.id}`');
    expect(source).toContain('id={`proposal-${attempt.id}`}');
  });

  it("marks report and advisor score queues without changing unlock logic", () => {
    const reports = readSource("src/app/teacher/reports/page.tsx");
    const advisorScore = readSource("src/app/teacher/advisor-score/page.tsx");

    expect(reports).toContain("reportQueueOrder");
    expect(reports).toContain("reportDecisionLabel");
    expect(reports).not.toContain('? "PASS" : "ขอแก้ไข"');
    expect(reports).toContain("latestReportHasRevisionRequest");
    expect(reports).toContain("allRequiredReportReviewersPassed");
    expect(advisorScore).toContain("advisorQueueOrder");
    expect(advisorScore).toContain("isAdvisorScoreEditable(project.status)");
    expect(advisorScore).toContain('previous?.status === "SUBMITTED"');
  });
});
