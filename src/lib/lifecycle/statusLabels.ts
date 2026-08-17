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
  PROPOSAL_REVISION_REQUIRED: "แก้ไข Proposal ตามมติ",
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
  "PROPOSAL_REVISION_REQUIRED",
  "TOPIC_APPROVED",
  "IN_PROGRESS",
  "FINAL_DONE",
  "REPORT_REVIEW",
  "REPORT_APPROVED",
  "ADVISOR_SCORING",
  "COMPLETED"
];

export const lifecyclePhases = [
  { label: "ข้อมูลนักศึกษา", statuses: ["STUDENT_PROFILE"] },
  { label: "จัดทำหัวข้อ", statuses: ["DRAFT"] },
  { label: "ที่ปรึกษาพิจารณา", statuses: ["PENDING_ADVISOR", "ORIGIN_SUBMITTED"] },
  { label: "ผู้ดูแลระบบยืนยัน", statuses: ["PENDING_ADMIN"] },
  { label: "ส่ง Proposal", statuses: ["PROPOSAL_PENDING", "COMMITTEE_ASSIGNED_FOR_REPROPOSAL"] },
  {
    label: "ประเมิน Proposal",
    statuses: ["PROPOSAL_REVIEW", "PROPOSAL_SUBMITTED", "PROPOSAL_UNDER_REVIEW", "REPROPOSAL_SUBMITTED", "REPROPOSAL_UNDER_REVIEW"]
  },
  { label: "มติ/แก้ไข Proposal", statuses: ["PROPOSAL_ADMIN_DECISION", "PROPOSAL_REVISION_REQUIRED", "PROPOSAL_FAILED", "REPROPOSAL_FAILED"] },
  { label: "หัวข้อผ่าน/แต่งตั้งกรรมการ", statuses: ["TOPIC_APPROVED", "PROPOSAL_PASSED", "REPROPOSAL_PASSED"] },
  { label: "ดำเนินโครงงาน/สอบความก้าวหน้า", statuses: ["IN_PROGRESS", "READY_FOR_PROGRESS_1", "IN_PROGRESS_1", "IN_PROGRESS_2"] },
  { label: "สอบนำเสนอขั้นสุดท้าย", statuses: ["READY_FOR_FINAL", "FINAL_DONE"] },
  { label: "ตรวจรายงาน", statuses: ["REPORT_REVIEW"] },
  { label: "รายงานผ่าน", statuses: ["REPORT_APPROVED"] },
  { label: "คะแนนที่ปรึกษา/ยืนยันจบ", statuses: ["ADVISOR_SCORING"] },
  { label: "เสร็จสมบูรณ์", statuses: ["COMPLETED"] }
] as const satisfies ReadonlyArray<{ label: string; statuses: readonly ProjectStatus[] }>;

const lifecyclePhaseNumberByStatus = {
  STUDENT_PROFILE: 1,
  DRAFT: 2,
  PENDING_ADVISOR: 3,
  ORIGIN_SUBMITTED: 3,
  PENDING_ADMIN: 4,
  PROPOSAL_PENDING: 5,
  COMMITTEE_ASSIGNED_FOR_REPROPOSAL: 5,
  PROPOSAL_REVIEW: 6,
  PROPOSAL_SUBMITTED: 6,
  PROPOSAL_UNDER_REVIEW: 6,
  REPROPOSAL_SUBMITTED: 6,
  REPROPOSAL_UNDER_REVIEW: 6,
  PROPOSAL_ADMIN_DECISION: 7,
  PROPOSAL_REVISION_REQUIRED: 7,
  PROPOSAL_FAILED: 7,
  REPROPOSAL_FAILED: 7,
  TOPIC_APPROVED: 8,
  PROPOSAL_PASSED: 8,
  REPROPOSAL_PASSED: 8,
  IN_PROGRESS: 9,
  READY_FOR_PROGRESS_1: 9,
  IN_PROGRESS_1: 9,
  IN_PROGRESS_2: 9,
  READY_FOR_FINAL: 10,
  FINAL_DONE: 10,
  REPORT_REVIEW: 11,
  REPORT_APPROVED: 12,
  ADVISOR_SCORING: 13,
  COMPLETED: 14
} satisfies Record<ProjectStatus, number>;

export function lifecycleStepPosition(status: ProjectStatus) {
  return {
    current: lifecyclePhaseNumberByStatus[status],
    total: lifecyclePhases.length
  };
}
