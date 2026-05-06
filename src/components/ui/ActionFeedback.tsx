import { InfoAlert, SuccessAlert, WarningAlert } from "./Alert";

const successMessages: Record<string, string> = {
  final_decision_saved: "บันทึกผลเรียบร้อยแล้ว",
  proposal_round_closed: "ปิดรอบ Proposal แล้ว",
  progress_1_opened: "เปิดรอบ Progress 1 แล้ว",
  progress_1_closed: "ปิดรอบ Progress 1 แล้ว",
  round_opened: "เปิดรอบแล้ว",
  round_closed: "ปิดรอบแล้ว",
  project_advisor_confirmed: "ยืนยันโปรเจคและอาจารย์ที่ปรึกษาแล้ว",
  committee_saved: "บันทึกการแต่งตั้ง HEAD และ MEMBER แล้ว",
  feedback_released: "เปิด feedback ให้นักศึกษาเห็นแล้ว",
  student_profile_saved: "บันทึกข้อมูลนักศึกษาเรียบร้อยแล้ว",
  project_submitted: "ส่งคำขอให้อาจารย์ที่ปรึกษาแล้ว",
  proposal_submitted: "ส่ง Proposal แล้ว",
  advisor_request_reviewed: "บันทึกผลคำขอที่ปรึกษาแล้ว",
  proposal_score_saved: "บันทึก comment แล้ว",
  schedule_saved: "บันทึกข้อเสนอวันสอบเรียบร้อยแล้ว",
  progress_1_score_saved: "บันทึกคะแนน Progress 1 เรียบร้อยแล้ว",
  progress_2_score_saved: "บันทึกคะแนน Progress 2 เรียบร้อยแล้ว",
  final_score_saved: "บันทึกคะแนน Final Presentation เรียบร้อยแล้ว",
  report_submitted: "ส่งเล่มรายงานเรียบร้อยแล้ว",
  report_review_saved: "บันทึกผลตรวจเล่มเรียบร้อยแล้ว",
  report_revision_requested: "บันทึกผลขอแก้ไขเล่มแล้ว",
  report_approved: "อนุมัติเล่มรายงานแล้ว",
  advisor_score_saved: "บันทึก Advisor score 25% เรียบร้อยแล้ว",
  project_completed: "ปิดงานโครงงานเรียบร้อยแล้ว",
  teacher_claim_reviewed: "บันทึกผลคำขอผูกบัญชีอาจารย์แล้ว"
};

const errorMessages: Record<string, string> = {
  action_failed: "ไม่สามารถทำรายการได้ กรุณาลองใหม่อีกครั้ง"
};

successMessages.course_offering_opened = "เปิดรายวิชาเรียบร้อยแล้ว";
successMessages.students_imported = "นำเข้านักศึกษาในรายวิชานี้เรียบร้อยแล้ว";
successMessages.teacher_baseline_seeded = "เพิ่มข้อมูลอาจารย์พื้นฐานเรียบร้อยแล้ว";
errorMessages.invalid_year = "ปีการศึกษาไม่ถูกต้อง กรุณากรอกเป็นปี พ.ศ. เช่น 2569";
errorMessages.invalid_term = "ภาคเรียนไม่ถูกต้อง กรุณาเลือก 1, 2 หรือ summer";
errorMessages.invalid_course_title = "ชื่อรายวิชายาวเกินไป";
errorMessages.course_offering_duplicate = "มีรายวิชานี้ในปีการศึกษาและภาคเรียนที่เลือกแล้ว";
errorMessages.course_offering_missing = "ไม่พบ Course Offering ที่เลือก กรุณาเปิดรายวิชาก่อนนำเข้านักศึกษา";
errorMessages.student_import_empty = "ไม่พบข้อมูลนักศึกษาใน CSV";

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
