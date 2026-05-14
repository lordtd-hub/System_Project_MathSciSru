import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("workflow email notification wiring", () => {
  it("keeps email delivery best-effort and behind explicit environment flags", () => {
    const email = read("src/lib/notifications/email.ts");
    const templates = read("src/lib/notifications/templates.ts");
    const envExample = read(".env.example");
    expect(email).toContain('EMAIL_NOTIFICATIONS_ENABLED === "1"');
    expect(email).toContain("RESEND_API_KEY");
    expect(email).toContain('"Content-Type": "application/json; charset=utf-8"');
    expect(email).toContain('<meta charset="utf-8" />');
    expect(email).toContain("ระบบประเมินการนำเสนอโครงงาน");
    expect(templates).toContain("หลังการนำเสนอและซักถามในรอบ Proposal");
    expect(envExample).toContain('EMAIL_FROM="ระบบประเมินการนำเสนอโครงงาน <notify@example.com>"');
  });

  it("wires advisor request, proposal, and schedule events without changing server action redirects", () => {
    const studentActions = read("src/app/student/actions.ts");
    expect(studentActions).toContain("notifyAdvisorRequestSubmitted(project.id, data.tentativeAdvisorId)");
    expect(studentActions).toContain("notifyProposalSubmitted(project.id, proposalTeachers.map((teacher) => teacher.id))");
    expect(studentActions).toContain("notifyExamScheduleProposed({");
    expect(studentActions).toContain('redirect("/student/project?success=project_submitted")');
    expect(studentActions).toContain('redirect("/student/proposal?success=proposal_submitted")');
    expect(studentActions).toContain('success: "schedule_saved"');
  });

  it("keeps notification links on existing workflow routes", () => {
    const workflowEmail = read("src/lib/notifications/workflowEmail.ts");
    expect(workflowEmail).toContain('buildAppUrl("/teacher/advisor-requests")');
    expect(workflowEmail).toContain('buildAppUrl("/teacher/proposals")');
    expect(workflowEmail).toContain('buildAppUrl("/teacher/schedules")');
    expect(workflowEmail).toContain("buildProposalSubmittedEmailTemplate");
    expect(workflowEmail).toContain("emailReady: true");
  });
});
