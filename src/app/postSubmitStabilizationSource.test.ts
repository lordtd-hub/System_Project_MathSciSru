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
