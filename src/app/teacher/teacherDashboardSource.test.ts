import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(join(process.cwd(), "src/app/teacher/page.tsx"), "utf8");
const cssSource = () => readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

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

  it("keeps teacher dashboard work queues and proposal links reviewer-specific", () => {
    const page = source();

    expect(page).toContain("teacherActionableTaskCount");
    expect(page).toContain("TeacherWorkloadSummary");
    expect(page).toContain("teacherWorkloadSummaryMetrics");
    expect(page).not.toContain("GuidancePanel");
    expect(page).not.toContain("TaskListCard");
    expect(page).toContain("teacherActionableTaskCount");
    expect(page).not.toContain("การแจ้งเตือน");
    expect(page).not.toContain("prisma.notification.findMany");
    expect(page).not.toContain("assignmentSubmitted");
    expect(page).toContain("Proposal ที่ต้องประเมิน");
    expect(page).toContain("pendingProposalScoreCount");
    expect(page).toContain("pendingProposalScoringAttemptWhere(evaluatorUserId)");
    expect(page).toContain("prisma.assessmentAttempt.count");
    expect(page).toContain("const proposalPreviewLimit = 8");
    expect(page).toContain("where: pendingProposalWhere");
    expect(page).toContain("pendingProposalScoreCount > pendingProposalAttempts.length");
    expect(page).toContain("ยังมีอีก {pendingProposalScoreCount - pendingProposalAttempts.length} งาน ดูทั้งหมด");
    expect(page).not.toContain("const pendingProposalScores = attempts.filter");
    expect(page).toContain("/teacher/advicees");
  });

  it("keeps the classic dashboard compact without alternate renderer fallback UI", () => {
    const page = source();
    const css = cssSource();

    expect(page).toContain("teacher-agenda-list");
    expect(page).toContain("CompactMetricRow");
    expect(page).not.toContain("บัญชีและบทบาท");
    expect(page).not.toContain("notifications.slice(0, 4)");
    expect(css).toContain(".teacher-agenda-list");
    expect(css).toContain("max-height: 15rem");
    expect(css).toContain(".dashboard-agenda-panel");
    expect(css).toContain(".teacher-workload-metric-grid");
    expect(css).toContain("lg:grid-cols-6");
    expect(css).toContain(".compact-metric-grid");
  });
});
