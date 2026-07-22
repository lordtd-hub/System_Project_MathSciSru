import { InfoAlert, SuccessAlert, WarningAlert } from "./Alert";

const successMessages: Record<string, string> = {
  final_decision_saved: "บันทึกผลเรียบร้อยแล้ว",
  proposal_round_closed: "ปิดรอบการเสนอหัวข้อแล้ว",
  progress_1_opened: "เปิดรอบสอบความก้าวหน้าครั้งที่ 1 แล้ว",
  progress_1_closed: "ปิดรอบสอบความก้าวหน้าครั้งที่ 1 แล้ว",
  round_opened: "เปิดรอบแล้ว",
  round_closed: "ปิดรอบแล้ว",
  round_reset: "รีเซตรอบสอบเรียบร้อยแล้ว",
  project_advisor_confirmed: "ยืนยันโครงงานและอาจารย์ที่ปรึกษาแล้ว",
  committee_saved: "บันทึกการแต่งตั้งประธานและกรรมการแล้ว",
  feedback_released: "เปิดข้อเสนอแนะให้นักศึกษาเห็นแล้ว",
  student_profile_saved: "บันทึกข้อมูลนักศึกษาเรียบร้อยแล้ว",
  project_submitted: "ส่งคำขอให้อาจารย์ที่ปรึกษาแล้ว",
  proposal_submitted: "ส่งเอกสารเสนอหัวข้อแล้ว",
  advisor_request_reviewed: "บันทึกผลคำขอที่ปรึกษาแล้ว",
  proposal_score_saved: "บันทึกข้อเสนอแนะแล้ว",
  assessment_evidence_saved: "บันทึกเอกสารรอบสอบเรียบร้อยแล้ว",
  schedule_saved: "บันทึกข้อเสนอวันสอบเรียบร้อยแล้ว",
  progress_1_score_saved: "บันทึกคะแนนสอบความก้าวหน้าครั้งที่ 1 เรียบร้อยแล้ว",
  progress_2_score_saved: "บันทึกคะแนนสอบความก้าวหน้าครั้งที่ 2 เรียบร้อยแล้ว",
  final_score_saved: "บันทึกคะแนนสอบนำเสนอขั้นสุดท้ายเรียบร้อยแล้ว",
  report_submitted: "ส่งเล่มรายงานเรียบร้อยแล้ว",
  report_review_saved: "บันทึกผลตรวจเล่มเรียบร้อยแล้ว",
  report_revision_requested: "บันทึกผลขอแก้ไขรายงานแล้ว",
  report_approved: "อนุมัติเล่มรายงานแล้ว",
  advisor_score_saved: "บันทึกคะแนนสรุปของอาจารย์ที่ปรึกษา 25% เรียบร้อยแล้ว",
  project_completed: "ยืนยันจบโครงงานเรียบร้อยแล้ว",
  teacher_claim_reviewed: "บันทึกผลคำขอผูกบัญชีอาจารย์แล้ว"
};

const errorMessages: Record<string, string> = {
  action_failed: "ไม่สามารถทำรายการได้ กรุณาลองใหม่อีกครั้ง",
  material_link_invalid: "อนุญาตเฉพาะลิงก์ https จาก Google Drive, Google Docs หรือ Google Classroom เท่านั้น กรุณาอัปโหลดไฟล์ไว้ใน Google Drive/Docs/Classroom แล้วส่งลิงก์ใหม่",
  project_not_editable: "ขั้นตอนนี้ยังไม่เปิดให้แก้ไขข้อมูลโครงงาน กรุณาตรวจสอบสถานะล่าสุดของโครงงาน",
  student_required_field_missing: "กรุณากรอกข้อมูลในช่องที่จำเป็นให้ครบถ้วนก่อนส่งอีกครั้ง",
  student_declaration_missing: "กรุณาติ๊กยืนยันคำรับรองของนักศึกษาก่อนส่งข้อมูล",
  student_text_too_long: "ข้อความที่กรอกยาวเกินกว่าที่ระบบรองรับ กรุณาย่อข้อความหรือแนบรายละเอียดเพิ่มเติมเป็นลิงก์ Google Drive/Docs",
  student_markdown_invalid: "ข้อความที่กรอกมีรูปแบบที่ระบบไม่รองรับ กรุณาลบ HTML หรือปรับข้อความแล้วส่งใหม่อีกครั้ง",
  student_timeline_invalid: "แผนดำเนินงานไม่ถูกต้อง กรุณาระบุสัปดาห์เป็นตัวเลข 1-16 และให้สัปดาห์สิ้นสุดไม่อยู่ก่อนสัปดาห์เริ่ม",
  student_advisor_required: "กรุณาเลือกอาจารย์ที่ปรึกษาก่อนส่งคำขอโครงงาน",
  advisor_request_decision_invalid: "ผลการพิจารณาคำขอที่ปรึกษาไม่ถูกต้อง กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง",
  advisor_reject_reason_required: "กรุณาระบุเหตุผลในช่องหมายเหตุก่อนปฏิเสธคำขอที่ปรึกษา",
  advisor_request_comment_too_long: "หมายเหตุถึงนักศึกษายาวเกินกว่าที่ระบบรองรับ กรุณาย่อข้อความแล้วลองอีกครั้ง",
  teacher_text_too_long: "ข้อความที่กรอกยาวเกินกว่าที่ระบบรองรับ กรุณาย่อข้อความแล้วลองอีกครั้ง",
  teacher_markdown_invalid: "ข้อความที่กรอกมีรูปแบบที่ระบบไม่รองรับ กรุณาลบ HTML หรือปรับข้อความแล้วลองอีกครั้ง",
  teacher_score_invalid: "ข้อมูลคะแนนไม่ครบถ้วนหรืออยู่นอกช่วงที่กำหนด กรุณาตรวจคะแนนแล้วส่งใหม่อีกครั้ง",
  schedule_review_decision_invalid: "ผลการพิจารณาวันสอบไม่ถูกต้อง กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง",
  schedule_reject_reason_required: "กรุณาระบุเหตุผลในช่องหมายเหตุก่อนกดไม่อนุมัติวันสอบ",
  proposal_decision_invalid: "ผลการพิจารณา Proposal ไม่ถูกต้อง กรุณาเลือกผลการประเมินแล้วลองอีกครั้ง",
  proposal_decision_reason_required: "กรุณาระบุเหตุผลเมื่อเลือกผ่านแบบแก้ไขหรือไม่ผ่าน",
  proposal_feedback_required: "กรุณาระบุข้อเสนอแนะเพื่อให้นักศึกษาใช้ปรับปรุงงาน",
  proposal_reason_too_long: "เหตุผลประกอบผล Proposal ยาวเกินกว่าที่ระบบรองรับ กรุณาย่อข้อความแล้วลองอีกครั้ง",
  report_review_decision_invalid: "ผลการตรวจรายงานไม่ถูกต้อง กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง",
  report_review_comment_required: "กรุณาระบุข้อเสนอแนะก่อนบันทึกผลตรวจรายงาน",
  schedule_time_invalid: "วันหรือเวลาสอบไม่ถูกต้อง กรุณาเลือกวันที่ เวลาเริ่ม และเวลาสิ้นสุดให้ถูกต้อง",
  schedule_request_locked: "ส่งขอนัดวันสอบแล้ว จึงแก้ไขวัน เวลา หรือห้องสอบไม่ได้ ต้องรอกรรมการอนุมัติหรือไม่อนุมัติก่อน"
};

successMessages.course_offering_opened = "เปิดรายวิชาเรียบร้อยแล้ว";
successMessages.students_imported = "นำเข้านักศึกษาในรายวิชานี้เรียบร้อยแล้ว";
successMessages.manual_students_imported = "เพิ่มนักศึกษาคู่มือเข้า roster ของรายวิชาเรียบร้อยแล้ว";
successMessages.course_offering_deleted = "ลบรายวิชาและข้อมูลที่ผูกกับรายวิชานี้เรียบร้อยแล้ว";
successMessages.teacher_baseline_seeded = "เพิ่มข้อมูลอาจารย์พื้นฐานเรียบร้อยแล้ว";
successMessages.teacher_email_updated = "บันทึกอีเมลอาจารย์เรียบร้อยแล้ว กรุณาให้อาจารย์ออกจากระบบแล้วเข้าสู่ระบบใหม่เพื่อปรับปรุงสิทธิ์การใช้งาน";
successMessages.test_course_reset = "ล้างข้อมูลทดสอบของรายวิชาเรียบร้อยแล้ว";
successMessages.qa_login = "เข้าสู่ QA session แล้ว";
successMessages.signed_out = "ออกจาก QA session แล้ว";
successMessages.schedule_approved = "อนุมัติวันสอบเรียบร้อยแล้ว";
successMessages.schedule_rejected = "บันทึกผลไม่อนุมัติวันสอบเรียบร้อยแล้ว";
errorMessages.invalid_year = "ปีการศึกษาไม่ถูกต้อง กรุณากรอกเป็นปี พ.ศ. เช่น 2569";
errorMessages.invalid_term = "ภาคเรียนไม่ถูกต้อง กรุณาเลือก 1, 2 หรือ summer";
errorMessages.invalid_course_title = "ชื่อรายวิชายาวเกินไป";
errorMessages.course_offering_duplicate = "มีรายวิชานี้ในปีการศึกษาและภาคเรียนที่เลือกแล้ว";
errorMessages.course_offering_missing = "ไม่พบรายวิชาที่เลือก กรุณาเปิดรายวิชาก่อนนำเข้านักศึกษา";
errorMessages.student_import_empty = "ไม่พบข้อมูลนักศึกษาใน CSV";
errorMessages.round_already_open = "รอบนี้เปิดอยู่แล้ว";
errorMessages.round_already_closed = "รอบนี้ปิดแล้ว หากต้องเปิดใหม่ควรจัดการเป็นกรณีพิเศษ";
errorMessages.proposal_must_close_first = "ต้องเปิดและปิดรอบการเสนอหัวข้อก่อน แล้วจึงเปิดรอบสอบความก้าวหน้าครั้งที่ 1";
errorMessages.progress_1_not_ready = "ยังไม่มีโครงงานที่พร้อมเข้าสู่การสอบความก้าวหน้าครั้งที่ 1";
errorMessages.progress_1_must_close_first = "ต้องเปิดและปิดรอบสอบความก้าวหน้าครั้งที่ 1 ก่อน แล้วจึงเปิดรอบสอบความก้าวหน้าครั้งที่ 2";
errorMessages.progress_2_must_close_first = "ต้องเปิดและปิดรอบสอบความก้าวหน้าครั้งที่ 2 ก่อน แล้วจึงเปิดรอบสอบนำเสนอขั้นสุดท้าย";
errorMessages.round_reset_blocked = "รีเซตไม่ได้ เพราะรอบนี้มีหลักฐานการส่งงาน การประเมิน ตารางสอบ หรือข้อยกเว้นแล้ว";
errorMessages.round_reset_not_needed = "รอบนี้ยังไม่ได้เปิด จึงไม่ต้องรีเซต";
errorMessages.test_tools_disabled = "โหมดทดสอบระบบยังไม่ได้เปิดใช้งาน";
errorMessages.proposal_not_available = "ยังไม่สามารถส่งเอกสารเสนอหัวข้อในสถานะปัจจุบันได้";
errorMessages.proposal_origin_missing = "กรุณาส่งข้อมูลเสนอหัวข้อก่อนส่งเอกสารเสนอหัวข้อ";
errorMessages.proposal_round_not_open = "ยังส่งเอกสารเสนอหัวข้อไม่ได้ เพราะผู้ดูแลระบบยังไม่ได้เปิดรอบการเสนอหัวข้อ หรือรอบถูกปิดแล้ว";
errorMessages.proposal_deadline_passed = "พ้นกำหนดส่งเอกสารเสนอหัวข้อแล้ว กรุณาติดต่อผู้ดูแลระบบ";

errorMessages.schedule_round_invalid = "รอบสอบไม่ถูกต้อง กรุณาเลือกสอบความก้าวหน้าครั้งที่ 1 ครั้งที่ 2 หรือสอบนำเสนอขั้นสุดท้าย";
errorMessages.schedule_not_available = "ยังเสนอวันสอบไม่ได้ในสถานะปัจจุบัน";
errorMessages.schedule_round_not_open = "ยังเสนอวันสอบไม่ได้ เพราะผู้ดูแลระบบยังไม่ได้เปิดรอบสอบนี้ หรือรอบถูกปิดแล้ว";
errorMessages.schedule_already_reviewed = "รายการวันสอบนี้ถูกพิจารณาแล้ว หรือไม่อยู่ในสถานะรออนุมัติ";
errorMessages.progress_1_project_not_ready = "โครงงานนี้ยังไม่พร้อมสำหรับการสอบความก้าวหน้าครั้งที่ 1 กรุณาตรวจสอบผลการเสนอหัวข้อและกรรมการก่อน";
errorMessages.assessment_evidence_required = "กรุณาบันทึกเอกสาร/หลักฐานของรอบสอบนี้ก่อนเสนอวันสอบ";
errorMessages.assessment_evidence_locked = "ส่งเสนอวันสอบแล้ว จึงแก้ไขเอกสาร/หลักฐานของรอบนี้ไม่ได้ หากต้องเปลี่ยนหลักฐานให้ประสานกรรมการหรือผู้ดูแลระบบก่อน";
errorMessages.schedule_previous_round_incomplete = "ยังดำเนินการรอบก่อนหน้าไม่ครบ จึงยังบันทึกเอกสารหรือเสนอวันสอบรอบนี้ไม่ได้";
errorMessages.report_not_available = "ยังส่งเล่มรายงานไม่ได้ในสถานะปัจจุบัน กรุณาตรวจสอบขั้นตอนของโครงงาน";

errorMessages.proposal_rubric_missing = "ยังไม่มีเกณฑ์ประเมินสำหรับการเสนอหัวข้อ กรุณาให้ผู้ดูแลระบบตั้งค่าเกณฑ์ประเมินมาตรฐานก่อนประเมิน";
successMessages.rubric_baseline_seeded = "ตั้งค่าเกณฑ์ประเมินมาตรฐานสำหรับการเสนอหัวข้อ การสอบความก้าวหน้าครั้งที่ 1 ครั้งที่ 2 และการสอบนำเสนอขั้นสุดท้ายเรียบร้อยแล้ว";
successMessages.qa_teachers_prepared = "เตรียม Teacher profiles สำหรับ QA เรียบร้อยแล้ว";
successMessages.qa_pilot_identities_prepared = "เตรียมบัญชีทดสอบสำหรับ Multi-User Pilot เรียบร้อยแล้ว";
successMessages.multi_pilot_r2_prepared = "Prepared MULTI-PILOT-R2 QA data.";
successMessages.multi_pilot_r2_wave2_prepared = "Prepared MULTI-PILOT-R2 Wave 2 QA data.";
successMessages.late_round_opened = "เปิดให้ดำเนินการย้อนหลังเป็นรายกรณีแล้ว";
errorMessages.round_close_missing_ack_required = "ยังมีนักศึกษาค้างส่งในรอบนี้ กรุณาตรวจรายชื่อและยืนยันก่อนปิดรอบ";
errorMessages.late_round_requires_closed_round = "เปิดส่งย้อนหลังได้เฉพาะรอบที่ปิดแล้ว";
errorMessages.proposal_round_closed_contact_admin = "พ้นกำหนดส่ง Proposal แล้ว กรุณาติดต่ออาจารย์ผู้รับผิดชอบหรือผู้ดูแลระบบเพื่อพิจารณาเปิดเป็นรายกรณี";

export function ActionFeedback({
  success,
  error,
  info
}: {
  success?: string | string[];
  error?: string | string[];
  info?: string | string[];
}) {
  const successKey = Array.isArray(success) ? success[0] : success;
  const errorKey = Array.isArray(error) ? error[0] : error;
  const infoKey = Array.isArray(info) ? info[0] : info;

  if (successKey) {
    return <SuccessAlert title={successMessages[successKey] ?? successKey} />;
  }
  if (errorKey) {
    return <WarningAlert title={errorMessages[errorKey] ?? errorKey} />;
  }
  if (infoKey) {
    return <InfoAlert title={infoKey} />;
  }
  return null;
}
