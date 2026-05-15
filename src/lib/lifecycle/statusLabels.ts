import type { ProjectStatus } from "@prisma/client";

export const projectStatusLabelsTh: Record<ProjectStatus, string> = {
  STUDENT_PROFILE: "กรอกข้อมูลนักศึกษา",
  DRAFT: "จัดทำร่างหัวข้อโครงงาน",
  PENDING_ADVISOR: "รออาจารย์ที่ปรึกษาพิจารณา",
  PENDING_ADMIN: "รอผู้ดูแลระบบยืนยัน",
  PROPOSAL_PENDING: "รอส่งเอกสารเสนอหัวข้อ",
  PROPOSAL_REVIEW: "อยู่ระหว่างประเมินการเสนอหัวข้อ",
  PROPOSAL_ADMIN_DECISION: "รอบันทึกมติผลการเสนอหัวข้อ",
  TOPIC_APPROVED: "หัวข้อโครงงานได้รับอนุมัติ",
  IN_PROGRESS: "ดำเนินโครงงาน",
  FINAL_DONE: "การสอบนำเสนอขั้นสุดท้ายเสร็จสิ้น",
  REPORT_REVIEW: "อยู่ระหว่างตรวจรายงานฉบับสมบูรณ์",
  REPORT_APPROVED: "รายงานฉบับสมบูรณ์ผ่านการตรวจ",
  ADVISOR_SCORING: "ช่วงคะแนนที่ปรึกษา/ยืนยันจบโครงงาน",
  COMPLETED: "โครงงานเสร็จสมบูรณ์",
  ORIGIN_SUBMITTED: "ส่งข้อมูลที่มาหัวข้อแล้ว (สถานะเดิม)",
  PROPOSAL_SUBMITTED: "ส่งเอกสารเสนอหัวข้อแล้ว (สถานะเดิม)",
  PROPOSAL_UNDER_REVIEW: "อยู่ระหว่างประเมินการเสนอหัวข้อ (สถานะเดิม)",
  PROPOSAL_PASSED: "การเสนอหัวข้อผ่าน (สถานะเดิม)",
  PROPOSAL_REVISION_REQUIRED: "การเสนอหัวข้อต้องแก้ไข (สถานะเดิม)",
  PROPOSAL_FAILED: "การเสนอหัวข้อไม่ผ่าน (สถานะเดิม)",
  COMMITTEE_ASSIGNED_FOR_REPROPOSAL: "แต่งตั้งกรรมการสำหรับการเสนอหัวข้อใหม่ (สถานะเดิม)",
  REPROPOSAL_SUBMITTED: "ส่งเอกสารเสนอหัวข้อใหม่แล้ว (สถานะเดิม)",
  REPROPOSAL_UNDER_REVIEW: "อยู่ระหว่างประเมินการเสนอหัวข้อใหม่ (สถานะเดิม)",
  REPROPOSAL_PASSED: "การเสนอหัวข้อใหม่ผ่าน (สถานะเดิม)",
  REPROPOSAL_FAILED: "การเสนอหัวข้อใหม่ไม่ผ่าน (สถานะเดิม)",
  READY_FOR_PROGRESS_1: "พร้อมเข้าสอบความก้าวหน้าครั้งที่ 1 (สถานะเดิม)",
  IN_PROGRESS_1: "อยู่ระหว่างสอบความก้าวหน้าครั้งที่ 1 (สถานะเดิม)",
  IN_PROGRESS_2: "อยู่ระหว่างสอบความก้าวหน้าครั้งที่ 2 (สถานะเดิม)",
  READY_FOR_FINAL: "พร้อมเข้าสอบนำเสนอขั้นสุดท้าย (สถานะเดิม)"
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
