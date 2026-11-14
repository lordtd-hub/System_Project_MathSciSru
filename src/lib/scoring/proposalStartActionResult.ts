export type ProposalStartActionResult =
  | { status: "idle" }
  | { status: "success"; code: "proposal_assignment_ready"; requestId: string; assignmentId: string; unchanged: boolean }
  | { status: "validation" | "conflict" | "rate_limit" | "unexpected"; code: string; requestId: string };

export const initialProposalStartActionResult: ProposalStartActionResult = { status: "idle" };

export function proposalStartActionMessage(result: ProposalStartActionResult) {
  if (result.status === "idle" || result.status === "success") return null;
  const messages: Record<string, string> = {
    proposal_attempt_missing: "ไม่พบรายการเสนอหัวข้อนี้ กรุณาโหลดหน้านี้ใหม่แล้วลองอีกครั้ง",
    proposal_decision_already_saved: "ผู้ดูแลระบบบันทึกผลตัดสินการเสนอหัวข้อแล้ว จึงไม่สามารถเริ่มการประเมินใหม่ได้",
    proposal_round_not_open: "รอบการเสนอหัวข้อปิดการให้คะแนนแล้ว",
    teacher_profile_missing: "ไม่พบโปรไฟล์อาจารย์ของบัญชีนี้ กรุณาติดต่อผู้ดูแลระบบหรือผูกบัญชีอาจารย์ใหม่",
    teacher_not_eligible: "บัญชีนี้ยังไม่มีสิทธิ์ประเมินการเสนอหัวข้อ กรุณาติดต่อผู้ดูแลระบบเพื่อตรวจสอบสถานะอาจารย์ภายในและสิทธิ์ประเมิน",
    proposal_start_rate_limited: "มีการกดเริ่มประเมินถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
    proposal_start_unexpected: `เปิดแบบประเมินไม่สำเร็จ กรุณาลองใหม่ (รหัส ${result.requestId})`
  };
  return messages[result.code] ?? `เปิดแบบประเมินไม่สำเร็จ กรุณาลองใหม่ (รหัส ${result.requestId})`;
}
