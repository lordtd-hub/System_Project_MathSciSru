import type { AssessmentRoundType } from "@prisma/client";
import type { EmailNotificationPayload } from "@/lib/notifications/email";

export const EMAIL_BRAND_NAME = "ระบบประเมินการนำเสนอโครงงาน";

type WorkflowEmailTemplate = Omit<EmailNotificationPayload, "to" | "actionUrl">;

type ProjectTemplateInput = {
  projectLabel: string;
  recipientName?: string;
};

type ScheduleTemplateInput = ProjectTemplateInput & {
  roundType: AssessmentRoundType | string;
  scheduleRange: string;
  room: string | null;
};

function recipientLine(recipientName?: string) {
  return recipientName ? `\n\nผู้รับ: ${recipientName}` : "";
}

export function formatAssessmentRoundLabel(roundType: AssessmentRoundType | string) {
  if (roundType === "PROGRESS_1") return "สอบความก้าวหน้าครั้งที่ 1";
  if (roundType === "PROGRESS_2") return "สอบความก้าวหน้าครั้งที่ 2";
  if (roundType === "FINAL_PRESENTATION") return "สอบนำเสนอขั้นสุดท้าย";
  if (roundType === "PROPOSAL") return "Proposal";
  return String(roundType);
}

export function buildAdvisorRequestEmailTemplate(input: ProjectTemplateInput): WorkflowEmailTemplate {
  const title = "มีนักศึกษาขอเลือกท่านเป็นอาจารย์ที่ปรึกษา";
  return {
    subject: title,
    title,
    body: [
      input.projectLabel,
      "กรุณาเข้าสู่ระบบเพื่อพิจารณาคำขอเป็นอาจารย์ที่ปรึกษา"
    ].join("\n") + recipientLine(input.recipientName),
    actionLabel: "เปิดคำขอที่ปรึกษา",
    previewText: title
  };
}

export function buildExamScheduleProposedEmailTemplate(input: ScheduleTemplateInput): WorkflowEmailTemplate {
  const roundLabel = formatAssessmentRoundLabel(input.roundType);
  const title = `มีคำขอนัดวันสอบ ${roundLabel}`;
  return {
    subject: title,
    title,
    body: [
      input.projectLabel,
      `รอบสอบ: ${roundLabel}`,
      `วันเวลา: ${input.scheduleRange}`,
      `ห้อง: ${input.room || "ยังไม่ระบุ"}`,
      "กรุณาเข้าสู่ระบบเพื่ออนุมัติหรือไม่อนุมัติวันสอบ"
    ].join("\n") + recipientLine(input.recipientName),
    actionLabel: "เปิดตารางสอบ",
    previewText: title
  };
}
