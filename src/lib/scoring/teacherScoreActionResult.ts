export type TeacherScoreActionResult =
  | { status: "idle" }
  | { status: "success"; code: string; requestId: string; unchanged?: boolean }
  | { status: "validation" | "conflict" | "rate_limit" | "unexpected"; code: string; requestId: string; missingFields?: string[] };

export const initialTeacherScoreActionResult: TeacherScoreActionResult = { status: "idle" };

export function teacherScoreActionMessage(result: TeacherScoreActionResult) {
  if (result.status === "idle") return null;
  const messages: Record<string, string> = {
    proposal_score_draft_saved: "บันทึกร่างแล้ว ข้อมูลร่างยังไม่แสดงต่อนักศึกษา",
    proposal_score_submitted: "ยืนยันส่งคะแนนการเสนอหัวข้อแล้ว",
    proposal_score_updated: "ยืนยันส่งคะแนนการเสนอหัวข้อที่แก้ไขแล้ว",
    proposal_decision_invalid: "กรุณาเลือกผลการประเมิน",
    proposal_decision_reason_required: "กรุณาระบุเหตุผลเมื่อให้แก้ไขหรือไม่ผ่าน",
    proposal_feedback_required: "กรุณาระบุข้อเสนอแนะถึงนักศึกษา",
    proposal_rubric_missing: "ยังไม่มีเกณฑ์ประเมิน Proposal",
    score_rubric_incomplete: "กรุณาให้คะแนนให้ครบทุกหัวข้อ",
    proposal_decision_already_saved: "ผู้ดูแลระบบบันทึกผลตัดสินแล้ว จึงไม่สามารถแก้คะแนนได้",
    proposal_round_not_open: "รอบ Proposal ปิดการให้คะแนนแล้ว",
    teacher_text_too_long: "ข้อความยาวเกินกว่าที่ระบบกำหนด กรุณาลดความยาวแล้วลองใหม่",
    proposal_score_unexpected: `บันทึกคะแนนไม่สำเร็จ กรุณาลองใหม่ (รหัส ${result.requestId})`
  };
  return messages[result.code] ?? (result.status === "success" ? "บันทึกข้อมูลสำเร็จ" : `ดำเนินการไม่สำเร็จ (รหัส ${result.requestId})`);
}
