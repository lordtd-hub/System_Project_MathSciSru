const evidenceEventLabels: Record<string, string> = {
  PROJECT_COMPLETED: "ปิดโครงงานแล้ว",
  ADVISOR_SCORE_SUBMITTED: "บันทึกคะแนนอาจารย์ที่ปรึกษาแล้ว",
  REPORT_REVIEW_PASSED_BY_REVIEWER: "ผู้ตรวจอนุมัติรายงานแล้ว",
  REPORT_REVIEW_REVISION_REQUESTED: "ผู้ตรวจขอให้แก้ไขรายงาน",
  REPORT_VERSION_SUBMITTED: "ส่งรายงานฉบับใหม่แล้ว",
  ASSESSMENT_ROUND_OPENED: "เปิดรอบสอบแล้ว",
  ASSESSMENT_ROUND_CLOSED: "ปิดรอบสอบแล้ว",
  PROPOSAL_FINAL_DECISION: "บันทึกมติผลการเสนอหัวข้อแล้ว",
  PROPOSAL_FINAL_DECISION_RECORDED: "บันทึกมติผลการเสนอหัวข้อแล้ว",
  COMMITTEE_ASSIGNED: "แต่งตั้งคณะกรรมการแล้ว",
  SCHEDULE_PROPOSED: "เสนอวันสอบแล้ว",
  SCHEDULE_APPROVED: "อนุมัติวันสอบแล้ว",
  SCHEDULE_REJECTED: "ไม่สะดวกตามวันสอบที่เสนอ",
  SCORE_SUBMITTED: "บันทึกคะแนนแล้ว",
  FINAL_PRESENTATION_COMPLETED: "การสอบนำเสนอขั้นสุดท้ายเสร็จสิ้น",
  REPORT_APPROVED: "รายงานฉบับสมบูรณ์ผ่านการตรวจแล้ว",
  REPORT_REVISION_REQUESTED: "ผู้ตรวจขอให้แก้ไขรายงาน",
  FINAL_PRESENTATION_DONE: "การสอบนำเสนอขั้นสุดท้ายเสร็จสิ้น",
  FINAL_PRESENTATION_SCORE_SUBMITTED: "บันทึกคะแนนสอบนำเสนอขั้นสุดท้ายแล้ว",
  PROPOSAL_FINAL_DECISION_SAVED: "บันทึกมติผลการเสนอหัวข้อแล้ว",
  STUDENT_IMPORT: "นำเข้ารายชื่อนักศึกษาแล้ว",
  COURSE_OFFERING_OPENED: "เปิดรายวิชาที่เปิดสอนแล้ว"
};

export function evidenceEventLabel(value: string | null | undefined) {
  if (!value) return "เหตุการณ์หลักฐาน";
  const normalized = value.trim().replace(/[\s-]+/g, "_").toUpperCase();
  return evidenceEventLabels[value] ?? evidenceEventLabels[normalized] ?? value.replaceAll("_", " ").toLowerCase();
}

export function evidenceTimelineTitle(value: string | null | undefined) {
  if (!value) return "เหตุการณ์หลักฐาน";
  return value.replace(/\bversion\s+(\d+)\b/gi, "ฉบับที่ $1");
}
