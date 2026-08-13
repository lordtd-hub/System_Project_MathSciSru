export type ProposalFinalDecision = "PASS" | "PASS_WITH_REVISION" | "NOT_PASS";

export function proposalDecisionEditBlockReason({
  finalDecision,
  projectStatus,
  submissionStatus,
  hasActiveCommittee
}: {
  finalDecision?: ProposalFinalDecision | null;
  projectStatus: string;
  submissionStatus?: string | null;
  hasActiveCommittee: boolean;
}) {
  if (!finalDecision) {
    return submissionStatus === "SUBMITTED"
      && ["PROPOSAL_REVIEW", "PROPOSAL_ADMIN_DECISION"].includes(projectStatus)
      ? null
      : "สถานะ Proposal เปลี่ยนไปแล้ว กรุณาตรวจสอบประวัติก่อนบันทึกมติ";
  }
  if (finalDecision === "NOT_PASS" || projectStatus === "DRAFT") {
    return "มติไม่ผ่านถูกล็อกไว้เป็นหลักฐาน นักศึกษาต้องดำเนินการผ่าน Proposal รอบใหม่";
  }
  if (finalDecision === "PASS") {
    if (projectStatus !== "TOPIC_APPROVED" || submissionStatus !== "LOCKED") {
      return "สถานะ Proposal ที่ผ่านแล้วไม่สอดคล้องกับหลักฐาน กรุณาตรวจสอบประวัติ";
    }
    return hasActiveCommittee
      ? "แต่งตั้งกรรมการแล้ว จึงไม่สามารถแก้ไขมติ Proposal จากหน้านี้ได้"
      : null;
  }
  return projectStatus === "PROPOSAL_REVISION_REQUIRED"
    && ["RETURNED_FOR_REVISION", "SUBMITTED"].includes(submissionStatus ?? "")
    ? null
    : "สถานะฉบับแก้ไขไม่อนุญาตให้เปลี่ยนมติจากหน้านี้";
}

export function proposalDecisionRequiresReason(decision: ProposalFinalDecision | "") {
  return decision === "PASS_WITH_REVISION" || decision === "NOT_PASS";
}

export function proposalDecisionGuidance(decision: ProposalFinalDecision | "") {
  if (decision === "PASS") {
    return "ผ่าน: โครงการพร้อมเข้าสู่ขั้นตอนแต่งตั้งกรรมการ";
  }
  if (decision === "PASS_WITH_REVISION") {
    return "ผ่านโดยให้แก้ไข: นักศึกษาแก้ Proposal ในระบบและส่งให้อาจารย์ที่ปรึกษารับรอง โดยไม่สอบใหม่";
  }
  if (decision === "NOT_PASS") {
    return "ไม่ผ่าน: ยกเลิกที่ปรึกษาเดิม ให้นักศึกษาเริ่มหัวข้อและเลือกที่ปรึกษาใหม่ แล้วสอบ Re-proposal";
  }
  return "เลือกมติเพื่อดูขั้นตอนที่จะเกิดขึ้น";
}

export function proposalDecisionConfirmation({
  decision,
  studentLabel,
  isEditing
}: {
  decision: ProposalFinalDecision;
  studentLabel: string;
  isEditing: boolean;
}) {
  const action = isEditing ? "แก้ไขมติ" : "บันทึกมติ";
  if (decision === "PASS") {
    return `ยืนยัน${action}ของ ${studentLabel} เป็น “ผ่าน” หรือไม่? โครงการจะพร้อมเข้าสู่ขั้นตอนแต่งตั้งกรรมการ`;
  }
  if (decision === "PASS_WITH_REVISION") {
    return `ยืนยัน${action}ของ ${studentLabel} เป็น “ผ่านโดยให้แก้ไข” หรือไม่? นักศึกษาต้องแก้ Proposal ในระบบและให้อาจารย์ที่ปรึกษารับรอง โดยไม่สอบใหม่`;
  }
  return `ยืนยัน${action}ของ ${studentLabel} เป็น “ไม่ผ่าน” หรือไม่? ระบบจะยกเลิกที่ปรึกษาเดิมและให้นักศึกษาเริ่มหัวข้อ เลือกที่ปรึกษา และสอบใหม่`;
}
