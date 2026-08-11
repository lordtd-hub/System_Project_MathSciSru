export type TeacherScoreActionResult =
  | { status: "idle" }
  | { status: "success"; code: string; requestId: string; unchanged?: boolean }
  | { status: "validation" | "conflict" | "rate_limit" | "unexpected"; code: string; requestId: string; missingFields?: string[] };

export const initialTeacherScoreActionResult: TeacherScoreActionResult = { status: "idle" };

export function teacherScoreActionMessage(result: TeacherScoreActionResult) {
  if (result.status === "idle") return null;
  const unchanged = result.status === "success" && result.unchanged;
  const messages: Record<string, string> = {
    proposal_score_draft_saved: "บันทึกร่างแล้ว ข้อมูลร่างยังไม่แสดงต่อนักศึกษา",
    proposal_score_submitted: "ยืนยันส่งคะแนนการเสนอหัวข้อแล้ว",
    proposal_score_updated: "ยืนยันส่งคะแนนการเสนอหัวข้อที่แก้ไขแล้ว",
    progress_1_score_saved: "ยืนยันส่งคะแนน Progress 1 แล้ว",
    progress_1_score_updated: unchanged ? "คะแนน Progress 1 ตรงกับข้อมูลล่าสุดแล้ว" : "ยืนยันส่งคะแนน Progress 1 ที่แก้ไขแล้ว",
    progress_2_score_saved: "ยืนยันส่งคะแนน Progress 2 แล้ว",
    progress_2_score_updated: unchanged ? "คะแนน Progress 2 ตรงกับข้อมูลล่าสุดแล้ว" : "ยืนยันส่งคะแนน Progress 2 ที่แก้ไขแล้ว",
    final_score_saved: "ยืนยันส่งคะแนน Final แล้ว",
    final_score_updated: unchanged ? "คะแนน Final ตรงกับข้อมูลล่าสุดแล้ว" : "ยืนยันส่งคะแนน Final ที่แก้ไขแล้ว",
    proposal_decision_invalid: "กรุณาเลือกผลการประเมิน",
    proposal_decision_reason_required: "กรุณาระบุเหตุผลเมื่อให้แก้ไขหรือไม่ผ่าน",
    proposal_feedback_required: "กรุณาระบุข้อเสนอแนะถึงนักศึกษา",
    proposal_rubric_missing: "ยังไม่มีเกณฑ์ประเมิน Proposal",
    score_rubric_incomplete: "กรุณาให้คะแนนให้ครบทุกหัวข้อ",
    proposal_decision_already_saved: "ผู้ดูแลระบบบันทึกผลตัดสินแล้ว จึงไม่สามารถแก้คะแนนได้",
    proposal_round_not_open: "รอบ Proposal ปิดการให้คะแนนแล้ว",
    teacher_text_too_long: "ข้อความยาวเกินกว่าที่ระบบกำหนด กรุณาลดความยาวแล้วลองใหม่",
    teacher_markdown_invalid: "รูปแบบข้อเสนอแนะไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่",
    teacher_score_invalid: "คะแนนไม่ถูกต้อง กรุณาตรวจสอบทุกหัวข้อ",
    score_project_missing: "ไม่พบโครงงานที่ต้องการบันทึกคะแนน",
    score_context_missing: "ไม่พบข้อมูลรอบสอบหรือโครงงาน กรุณารีเฟรชแล้วลองใหม่",
    score_round_missing: "ยังไม่มีรอบสอบนี้ในรายวิชา",
    score_project_state_changed: "สถานะโครงงานเปลี่ยนแล้ว กรุณารีเฟรชก่อนบันทึกอีกครั้ง",
    score_schedule_not_confirmed: "ยังไม่ยืนยันกำหนดการสอบครบ จึงยังบันทึกคะแนนไม่ได้",
    score_evaluator_not_eligible: "บัญชีนี้ไม่มีสิทธิ์ให้คะแนนโครงงานนี้",
    score_editing_closed: "รอบนี้ปิดการแก้ไขคะแนนแล้ว",
    teacher_score_unexpected: `บันทึกคะแนนไม่สำเร็จ กรุณาลองใหม่ (รหัส ${result.requestId})`,
    proposal_score_unexpected: `บันทึกคะแนนไม่สำเร็จ กรุณาลองใหม่ (รหัส ${result.requestId})`
  };
  return messages[result.code] ?? (result.status === "success" ? "บันทึกข้อมูลสำเร็จ" : `ดำเนินการไม่สำเร็จ (รหัส ${result.requestId})`);
}
