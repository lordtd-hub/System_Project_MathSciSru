import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("workflow notification wiring", () => {
  it("keeps email delivery best-effort and behind explicit environment flags", () => {
    const email = read("src/lib/notifications/email.ts");
    const templates = read("src/lib/notifications/templates.ts");
    const envExample = read(".env.example");
    expect(email).toContain('EMAIL_NOTIFICATIONS_ENABLED === "1"');
    expect(email).toContain("RESEND_API_KEY");
    expect(email).toContain('"Content-Type": "application/json; charset=utf-8"');
    expect(email).toContain('<meta charset="utf-8" />');
    expect(email).toContain("ระบบประเมินการนำเสนอโครงงาน");
    expect(templates).toContain("มีนักศึกษาขอเลือกท่านเป็นอาจารย์ที่ปรึกษา");
    expect(templates).toContain("มีคำขอนัดวันสอบ");
    expect(templates).not.toContain("buildProposalSubmittedEmailTemplate");
    expect(envExample).toContain('EMAIL_FROM="ระบบประเมินการนำเสนอโครงงาน <notify@example.com>"');
  });

  it("keeps advisor external delivery post-commit and Proposal delivery in-app only", () => {
    const studentActions = read("src/app/student/actions.ts");
    const mutations = read("src/lib/projects/studentCurrentStageMutations.ts");
    const futureStageMutations = read("src/lib/projects/studentFutureStageMutations.ts");
    expect(studentActions).toContain("after(async () =>");
    expect(studentActions).toContain("persistInApp: false");
    expect(mutations).toContain('kind: isReproposal ? "REPROPOSAL_SUBMITTED" : "PROPOSAL_SUBMITTED"');
    expect(mutations).toContain('ระบบจะไม่ส่งอีเมลหรือ LINE สำหรับการส่ง Re-proposal');
    expect(mutations).toContain("emailReady: false");
    expect(studentActions).toContain("deliverExamScheduleExternalNotification(notification)");
    expect(futureStageMutations).toContain('kind: "EXAM_SCHEDULE_PROPOSED"');
    expect(futureStageMutations).toContain("notification.createMany");
    expect(studentActions).toContain('"PROJECT_ORIGIN_SAVED"');
    expect(studentActions).toContain('"PROPOSAL_SUBMISSION_SAVED"');
    expect(studentActions).toContain('"EXAM_SCHEDULE_PROPOSED"');
  });

  it("keeps external notification links on existing workflow routes", () => {
    const workflowEmail = read("src/lib/notifications/workflowEmail.ts");
    expect(workflowEmail).toContain('buildAppUrl("/teacher/advisor-requests")');
    expect(workflowEmail).toContain('buildAppUrl("/teacher/schedules")');
    expect(workflowEmail).toContain("sendLineNotification");
    expect(workflowEmail).toContain("emailReady: true");
    expect(workflowEmail).toContain('kind: "PROPOSAL_SUBMITTED"');
    expect(workflowEmail).toContain("emailReady: false");
    expect(workflowEmail).toContain("จะไม่ส่งอีเมลหรือ LINE");
  });
});
