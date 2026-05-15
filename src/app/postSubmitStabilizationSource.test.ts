import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("post-submit stabilization source checks", () => {
  it("keeps student proposal and schedule pages populated after success redirects", () => {
    const proposalPage = read("src/app/student/proposal/page.tsx");
    const schedulePage = read("src/app/student/schedule/page.tsx");

    expect(proposalPage).toContain('params.success === "proposal_submitted"');
    expect(proposalPage).toContain("ส่ง Proposal สำเร็จ");
    expect(proposalPage).toContain("showSubmittedProposalState");
    expect(proposalPage).toContain('data-testid="student-proposal-submitted-summary"');
    expect(proposalPage).toContain('data-testid="student-proposal-late-submitted-notice"');
    expect(proposalPage).toContain("สถานะเอกสารเสนอหัวข้อ");
    expect(proposalPage).toContain("ส่งเอกสารเสนอหัวข้อแล้ว");
    expect(proposalPage).toContain("ส่ง Proposal หลังปิดรอบแล้ว");
    expect(proposalPage).toContain("presentationSubmissions: { orderBy: { createdAt: \"desc\" }, take: 1 }");
    expect(schedulePage).toContain('params.success === "assessment_evidence_saved"');
    expect(schedulePage).toContain("บันทึกหลักฐานการประเมินแล้ว");
    expect(schedulePage).toContain('export const dynamic = "force-dynamic"');
    expect(schedulePage).toContain("export const revalidate = 0");
    expect(schedulePage).toContain('data-testid="student-schedule-page-content"');
    expect(schedulePage).toContain('data-testid="student-schedule-evidence-success-alert"');
    expect(schedulePage).toContain('data-testid="student-schedule-round-status-cards"');
    expect(schedulePage).toContain('data-testid="student-schedule-evidence-summary"');
    expect(schedulePage).toContain('data-testid={`student-assessment-evidence-form-${kind}`}');
    expect(schedulePage).toContain('data-testid="student-schedule-proposal-form-wrapper"');
  });

  it("keeps assessment evidence success pages from rendering as shell-only for Progress and Final rounds", () => {
    const schedulePage = read("src/app/student/schedule/page.tsx");
    const studentActions = read("src/app/student/actions.ts");
    const studentLayout = read("src/app/student/layout.tsx");
    const postSubmitGuard = read("src/components/ui/StudentSchedulePostSubmitGuard.tsx");

    expect(studentActions).toContain('redirectWithQuery("/student/schedule", {');
    expect(studentActions).toContain('success: "assessment_evidence_saved"');
    expect(studentActions).toContain("assessment_kind: kind");
    expect(studentActions).toContain("submission_id: submission.id");
    expect(studentActions).toContain('success: "schedule_saved"');
    expect(studentActions).toContain("schedule_id: schedule.id");
    expect(schedulePage).toContain('params.success === "assessment_evidence_saved"');
    expect(schedulePage).toContain('(["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENT"] as const).map((kind)');
    expect(schedulePage).toContain('latestSubmissionByKind.has(kind) && !activeScheduleByKind.has(kind)');
    expect(schedulePage).toContain('const schedulableRoundsWithEvidence');
    expect(schedulePage).toContain('const editableEvidenceRounds');
    expect(schedulePage).toContain('data-testid={`student-schedule-evidence-summary-${kind}`}');
    expect(schedulePage).toContain('data-testid={`student-assessment-evidence-form-${kind}`}');
    expect(schedulePage).toContain('data-testid="student-schedule-proposal-form-wrapper"');
    expect(schedulePage).toContain('student-schedule-latest-proposals');
    expect(schedulePage).toContain('roundType === "PROGRESS_2"');
    expect(schedulePage).toContain('roundType === "FINAL_PRESENTATION"');
    expect(studentActions).toContain('error: "schedule_previous_round_incomplete"');
    expect(studentLayout).toContain("StudentSchedulePostSubmitGuard");
    expect(postSubmitGuard).toContain('url.pathname !== "/student/schedule"');
    expect(postSubmitGuard).toContain('"assessment_evidence_saved"');
    expect(postSubmitGuard).toContain('"schedule_saved"');
    expect(postSubmitGuard).toContain('document.querySelector(SCHEDULE_CONTENT_SELECTOR)');
    expect(postSubmitGuard).toContain("window.location.reload()");
  });

  it("keeps locked or unsupported schedule states visible instead of blank after redirects", () => {
    const schedulePage = read("src/app/student/schedule/page.tsx");
    const studentActions = read("src/app/student/actions.ts");

    expect(studentActions).toContain('error: "schedule_round_invalid"');
    expect(studentActions).toContain('error: "schedule_not_available"');
    expect(studentActions).toContain('error: "assessment_evidence_required"');
    expect(studentActions).toContain('error: "assessment_evidence_locked"');
    expect(schedulePage).toContain("progress1BlockedText");
    expect(schedulePage).toContain('data-testid="student-schedule-round-status-cards"');
    expect(schedulePage).toContain('data-testid={`student-schedule-round-card-${kind}`}');
    expect(schedulePage).toContain("ต้องบันทึกเอกสารก่อนเสนอวันสอบ");
    expect(schedulePage).toContain("ส่งเสนอวันสอบแล้ว");
  });

  it("uses one report action label across the student dashboard and report page", () => {
    const dashboardPage = read("src/app/student/page.tsx");
    const reportPage = read("src/app/student/report/page.tsx");

    expect(dashboardPage).toContain("getStudentReportActionLabel");
    expect(dashboardPage).toContain("reportActionLabel");
    expect(dashboardPage).toContain("reportActionDescription");
    expect(reportPage).toContain("getStudentReportActionLabel");
    expect(reportPage).toContain("projectStatus: project.status");
  });

  it("renders advisor requests and saved proposal decisions as explicit follow-up states", () => {
    const advisorRequestsPage = read("src/app/teacher/advisor-requests/page.tsx");
    const adminProposalPage = read("src/app/admin/proposals/page.tsx");

    expect(advisorRequestsPage).toContain('request.status === "PENDING" ?');
    expect(advisorRequestsPage).toContain("อนุมัติคำขอเป็นที่ปรึกษาแล้ว");
    expect(advisorRequestsPage).toContain("ปฏิเสธคำขอแล้ว");
    expect(adminProposalPage).toContain("แก้ไขผลการตัดสิน");
  });
});
