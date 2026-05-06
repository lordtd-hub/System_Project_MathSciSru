import type { ProjectStatus } from "@prisma/client";

export const projectStatusLabelsTh: Record<ProjectStatus, string> = {
  STUDENT_PROFILE: "กรอกข้อมูลส่วนตัวนักศึกษา",
  DRAFT: "ร่างโครงงาน",
  PENDING_ADVISOR: "รออาจารย์ที่ปรึกษาอนุมัติ",
  PENDING_ADMIN: "รอผู้ดูแลระบบยืนยัน",
  PROPOSAL_PENDING: "รอส่ง/จัดรอบ Proposal",
  PROPOSAL_REVIEW: "อยู่ระหว่างประเมิน Proposal",
  PROPOSAL_ADMIN_DECISION: "รอผู้ดูแลระบบตัดสินผล Proposal",
  TOPIC_APPROVED: "หัวข้อได้รับอนุมัติ",
  IN_PROGRESS: "กำลังดำเนินโครงงาน",
  FINAL_DONE: "นำเสนอ Final เสร็จแล้ว",
  REPORT_REVIEW: "ตรวจรูปเล่มรายงาน",
  REPORT_APPROVED: "รูปเล่มผ่านแล้ว",
  ADVISOR_SCORING: "รอปิดงานโดยผู้ดูแลระบบ",
  COMPLETED: "เสร็จสมบูรณ์",
  ORIGIN_SUBMITTED: "ส่งที่มาหัวข้อแล้ว (เดิม)",
  PROPOSAL_SUBMITTED: "ส่ง Proposal แล้ว (เดิม)",
  PROPOSAL_UNDER_REVIEW: "กำลังประเมิน Proposal (เดิม)",
  PROPOSAL_PASSED: "Proposal ผ่าน (เดิม)",
  PROPOSAL_REVISION_REQUIRED: "Proposal ต้องแก้ไข (เดิม)",
  PROPOSAL_FAILED: "Proposal ไม่ผ่าน (เดิม)",
  COMMITTEE_ASSIGNED_FOR_REPROPOSAL: "ตั้งกรรมการ Re-proposal (เดิม)",
  REPROPOSAL_SUBMITTED: "ส่ง Re-proposal (เดิม)",
  REPROPOSAL_UNDER_REVIEW: "กำลังประเมิน Re-proposal (เดิม)",
  REPROPOSAL_PASSED: "Re-proposal ผ่าน (เดิม)",
  REPROPOSAL_FAILED: "Re-proposal ไม่ผ่าน (เดิม)",
  READY_FOR_PROGRESS_1: "พร้อม Progress 1 (เดิม)",
  IN_PROGRESS_1: "อยู่ใน Progress 1 (เดิม)",
  IN_PROGRESS_2: "อยู่ใน Progress 2 (เดิม)",
  READY_FOR_FINAL: "พร้อม Final (เดิม)"
};

export function projectStatusLabelTh(status: ProjectStatus): string {
  return projectStatusLabelsTh[status] ?? status;
}

export const lifecycleV2Steps: ProjectStatus[] = [
  "STUDENT_PROFILE",
  "DRAFT",
  "PENDING_ADVISOR",
  "PENDING_ADMIN",
  "PROPOSAL_PENDING",
  "PROPOSAL_REVIEW",
  "PROPOSAL_ADMIN_DECISION",
  "TOPIC_APPROVED",
  "IN_PROGRESS",
  "FINAL_DONE",
  "REPORT_REVIEW",
  "REPORT_APPROVED",
  "ADVISOR_SCORING",
  "COMPLETED"
];
