import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(join(process.cwd(), "src/app/teacher/page.tsx"), "utf8");

describe("teacher dashboard source", () => {
  it("derives report and schedule counters from teacher-scoped actionable work", () => {
    const page = source();

    expect(page).not.toContain('prisma.reportReview.count({ where: { reviewerTeacherId: teacherId, decision: "FAIL" } })');
    expect(page).toContain('status: "REPORT_REVIEW"');
    expect(page).toContain("reportVersions");
    expect(page).toContain('review.decision === "FAIL"');
    expect(page).toContain("review.reviewerTeacherId === teacherId");
    expect(page).toContain("teacherProjectInvolvementWhere");
    expect(page).toContain('status: "CONFIRMED"');
  });

  it("keeps teacher notifications and proposal links reviewer-specific", () => {
    const page = source();

    expect(page).toContain("teacherActionableTaskCount");
    expect(page).toContain("TeacherWorkloadSummary");
    expect(page).not.toContain("GuidancePanel");
    expect(page).not.toContain("คำแนะนำสำหรับอาจารย์");
    expect(page).toContain("teacherWorkloadSummaryMetrics");
    expect(page).toContain("มีงานที่ต้องดำเนินการ");
    expect(page).toContain("การแจ้งเตือน");
    expect(page).toContain("assignmentSubmitted");
    expect(page).toContain("ดูผลประเมินที่ส่งแล้ว");
    expect(page).toContain("pendingProposalScores.length");
  });

  it("supports safe classic and figma dashboard renderers", () => {
    const page = source();
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const workloadQueue = readFileSync(join(process.cwd(), "src/components/ui/TeacherWorkloadQueue.tsx"), "utf8");

    expect(page).toContain("getUiMode");
    expect(page).toContain("FigmaTeacherDashboardView");
    expect(page).toContain("return <FigmaTeacherDashboardView");
    expect(page).toContain('uiMode === "figma"');
    expect(page).toContain("FigmaPageHeader");
    expect(page).toContain("FigmaMetricCard");
    expect(page).toContain("teacherDashboardViewProps");
    expect(page).toContain("figma-teacher-agenda-list");
    expect(css).toContain(".figma-teacher-agenda-list");
    expect(css).toContain("max-height: 12rem");
    expect(css).toContain(".figma-teacher-agenda-list .figma-status-badge");
    expect(workloadQueue).toContain("xl:grid-cols-6");
    expect(css).toContain("px-2 py-1.5");
  });
});
