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

    expect(source).toContain("getUiMode");
    expect(source).toContain('uiMode === "figma"');
    expect(source).toContain("FigmaReviewLayout");
    expect(source).toContain("figma-teacher-schedules");
    expect(source).toContain("figma-schedule-row");
    expect(source).toContain('className="panel order-1"');
    expect(source).toContain('className="panel order-3"');
    expect(source).toContain("pendingReviewSchedules");
    expect(source).toContain("waitingSchedules");
    expect(source).toContain("returnedSchedules");
    expect(source).toContain("TeacherCompactQueueList");
    expect(source).toContain("คิวอนุมัติวันสอบ");
    expect(source).toContain('approval.teacherId === teacher.id && approval.decision === "PENDING"');
  });

  it("adds compact proposal navigation before long proposal review cards", () => {
    const source = readSource("src/app/teacher/proposals/page.tsx");

    expect(source).toContain("getUiMode");
    expect(source).toContain('uiMode === "figma"');
    expect(source).toContain("FigmaReviewLayout");
    expect(source).toContain("figma-teacher-proposals");
    expect(source).toContain("figma-proposal-row");
    expect(source).toContain("TeacherCompactQueueList");
    expect(source).toContain("pendingAttempts.map");
    expect(source).toContain('href: `#proposal-${attempt.id}`');
    expect(source).toContain('id={`proposal-${attempt.id}`}');
  });

  it("adds figma review layout for Progress 1 without changing the scoring action", () => {
    const source = readSource("src/app/teacher/progress1/page.tsx");

    expect(source).toContain("getUiMode");
    expect(source).toContain('uiMode === "figma"');
    expect(source).toContain("FigmaReviewLayout");
    expect(source).toContain("figma-teacher-progress1");
    expect(source).toContain("figma-progress-row");
    expect(source).toContain("submitProgress1Score");
    expect(source).toContain('name="project_id"');
    expect(source).toContain("MarkdownLatexViewer");
    expect(source).toContain("MarkdownLatexEditor");
  });

  it("adds figma review layout for Progress 2 while preserving round-open handling", () => {
    const source = readSource("src/app/teacher/progress2/page.tsx");

    expect(source).toContain("getUiMode");
    expect(source).toContain('uiMode === "figma"');
    expect(source).toContain("FigmaReviewLayout");
    expect(source).toContain("figma-teacher-progress2");
    expect(source).toContain("figma-progress-row");
    expect(source).toContain("submitProgress2Score");
    expect(source).toContain('name="project_id"');
    expect(source).toContain("progress2Round");
    expect(source).toContain("MarkdownLatexViewer");
    expect(source).toContain("MarkdownLatexEditor");
  });

  it("adds figma review layout for Final without changing final scoring semantics", () => {
    const source = readSource("src/app/teacher/final/page.tsx");

    expect(source).toContain("getUiMode");
    expect(source).toContain('uiMode === "figma"');
    expect(source).toContain("FigmaReviewLayout");
    expect(source).toContain("figma-teacher-final");
    expect(source).toContain("figma-final-row");
    expect(source).toContain("submitFinalPresentationScore");
    expect(source).toContain('name="project_id"');
    expect(source).toContain("FinalEvidenceContinuityPanel");
    expect(source).toContain("FinalQaRubricPanel");
    expect(source).toContain("conditionCountForSavedScore");
  });

  it("adds figma report review layout without changing latest-version review semantics", () => {
    const source = readSource("src/app/teacher/reports/page.tsx");

    expect(source).toContain("getUiMode");
    expect(source).toContain('uiMode === "figma"');
    expect(source).toContain("FigmaReviewLayout");
    expect(source).toContain("figma-teacher-reports");
    expect(source).toContain("figma-report-row");
    expect(source).toContain("reviewReportVersion");
    expect(source).toContain('name="report_version_id"');
    expect(source).toContain("latestReportHasRevisionRequest");
    expect(source).toContain("allRequiredReportReviewersPassed");
    expect(source).toContain("reportHistory");
    expect(source).toContain("MarkdownLatexViewer");
    expect(source).toContain("MarkdownLatexEditor");
  });

  it("adds figma advisor-score layout without changing unlock and score field semantics", () => {
    const source = readSource("src/app/teacher/advisor-score/page.tsx");

    expect(source).toContain("getUiMode");
    expect(source).toContain('uiMode === "figma"');
    expect(source).toContain("FigmaReviewLayout");
    expect(source).toContain("figma-teacher-advisor-score");
    expect(source).toContain("figma-advisor-score-row");
    expect(source).toContain("submitAdvisorScore");
    expect(source).toContain('name="project_id"');
    expect(source).toContain('project.status === "REPORT_APPROVED" || project.status === "ADVISOR_SCORING"');
    expect(source).toContain('previous?.status === "SUBMITTED"');
    expect(source).toContain("advisorCriteria.map");
    expect(source).toContain("fieldName(criterion.key)");
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
