import type { ProjectStatus } from "@prisma/client";
import { shouldAlertAdminForFailVotes } from "@/lib/lifecycle/transitions";

export type NextAction = {
  title: string;
  description: string;
  actionLabel?: string;
  href?: string;
  tone?: "info" | "warning" | "success";
};

export type StudentWorkflowAction = {
  key: string;
  title: string;
  description: string;
  href?: string;
  state: "available" | "history" | "locked" | "blocked";
};

export type StudentAvailableActions = {
  available_now: StudentWorkflowAction[];
  read_only_history: StudentWorkflowAction[];
  locked_future: StudentWorkflowAction[];
  blocked_waiting_for: StudentWorkflowAction[];
};

function action(
  key: string,
  title: string,
  description: string,
  state: StudentWorkflowAction["state"],
  href?: string
): StudentWorkflowAction {
  return { key, title, description, state, href };
}

export function getStudentAvailableActions(
  status?: ProjectStatus | null,
  assessments: Partial<Record<"PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENT", "NOT_STARTED" | "SCHEDULED" | "SUBMITTED" | "COMPLETED">> = {},
  reportStatus?: "NONE" | "REVISION_REQUIRED" | "SUBMITTED" | "APPROVED"
): StudentAvailableActions {
  const result: StudentAvailableActions = {
    available_now: [],
    read_only_history: [],
    locked_future: [],
    blocked_waiting_for: []
  };
  const lockFuture = () => {
    result.locked_future.push(
      action("proposal", "Proposal", "ยังไม่ถึงขั้นตอนส่ง Proposal", "locked"),
      action("progress_1", "Progress 1", "ยังไม่ถึงขั้นตอน Progress 1", "locked"),
      action("progress_2", "Progress 2", "ยังไม่ถึงขั้นตอน Progress 2", "locked"),
      action("final_present", "Final Presentation", "ยังไม่ถึงขั้นตอน Final Presentation", "locked"),
      action("report", "รายงาน", "ยังไม่ถึงขั้นตอนส่งเล่มรายงาน", "locked")
    );
  };

  switch (status) {
    case "STUDENT_PROFILE":
      result.available_now.push(action("student_profile", "กรอกข้อมูลนักศึกษา", "ทำขั้นตอนนี้ก่อนสร้างโปรเจค", "available", "/student/profile"));
      lockFuture();
      break;
    case "DRAFT":
      result.available_now.push(
        action("project", "สร้าง/แก้ไขข้อมูลโครงงาน", "ระบุหัวข้อ เลือกที่ปรึกษา และส่งคำขอ", "available", "/student/project")
      );
      result.locked_future.push(
        action("proposal", "Proposal", "ส่งได้หลัง advisor และ Admin ยืนยัน", "locked"),
        action("progress_1", "Progress 1", "ยังไม่ถึงขั้นตอน", "locked"),
        action("progress_2", "Progress 2", "ยังไม่ถึงขั้นตอน", "locked"),
        action("final_present", "Final Presentation", "ยังไม่ถึงขั้นตอน", "locked"),
        action("report", "รายงาน", "ยังไม่ถึงขั้นตอน", "locked")
      );
      break;
    case "PENDING_ADVISOR":
      result.available_now.push(action("view_project", "ดูข้อมูลโครงงาน", "ตรวจสอบคำขอที่ส่งแล้ว", "available", "/student/project"));
      result.read_only_history.push(action("advisor_request", "รายละเอียดคำขอที่ปรึกษา", "คำขอถูกส่งแล้ว", "history", "/student/project"));
      result.blocked_waiting_for.push(action("waiting_advisor", "รออาจารย์ที่ปรึกษาอนุมัติ", "ยังส่ง Proposal ไม่ได้", "blocked"));
      break;
    case "PENDING_ADMIN":
      result.available_now.push(action("view_status", "ดูสถานะ", "ยังไม่มีรายการที่ต้องแก้ไข", "available", "/student"));
      result.blocked_waiting_for.push(action("waiting_admin", "รอผู้ดูแลระบบยืนยัน", "Admin ต้องยืนยันโปรเจคและอาจารย์ที่ปรึกษา", "blocked"));
      break;
    case "PROPOSAL_PENDING":
      result.available_now.push(action("proposal", "ส่ง Proposal", "แนบ abstract และ Google link", "available", "/student/proposal"));
      result.read_only_history.push(action("project", "ข้อมูลโครงงาน", "ส่งคำขอที่ปรึกษาแล้ว", "history", "/student/project"));
      result.locked_future.push(action("progress_1", "Progress 1", "รอผล Proposal", "locked"), action("report", "รายงาน", "ยังไม่ถึงขั้นตอน", "locked"));
      break;
    case "PROPOSAL_REVIEW":
    case "PROPOSAL_ADMIN_DECISION":
      result.read_only_history.push(action("proposal", "Proposal submission", "ส่งแล้ว ดู comment ได้", "history", "/student/proposal"));
      result.blocked_waiting_for.push(action("waiting_proposal_decision", "รอการตัดสินผลสอบหัวข้อ", "ยังแก้ไข Proposal ไม่ได้ เว้นแต่ระบบเปิดสิทธิ์", "blocked"));
      result.locked_future.push(action("progress_1", "Progress 1", "รอผล Proposal", "locked"), action("report", "รายงาน", "ยังไม่ถึงขั้นตอน", "locked"));
      break;
    case "TOPIC_APPROVED":
      result.read_only_history.push(action("proposal", "Proposal ผ่านแล้ว", "ดูข้อมูลย้อนหลังได้", "history", "/student/proposal"));
      result.available_now.push(action("committee", "ดูการแต่งตั้งกรรมการ", "รอ Admin แต่งตั้ง HEAD และ MEMBER", "available", "/student/schedule"));
      result.locked_future.push(action("progress_1", "Progress 1", "เสนอวันสอบได้หลังกรรมการพร้อม", "locked"));
      break;
    case "IN_PROGRESS": {
      result.read_only_history.push(action("proposal", "Proposal", "ดูย้อนหลัง", "history", "/student/proposal"));
      const p1 = assessments.PROGRESS_1;
      const p2 = assessments.PROGRESS_2;
      const final = assessments.FINAL_PRESENT;
      if (p1 !== "COMPLETED") {
        result.available_now.push(action("progress_1", "Progress 1", "ดำเนินการ Progress 1 ได้ตอนนี้", "available", "/student/schedule"));
        result.locked_future.push(action("progress_2", "Progress 2", "ทำได้หลัง Progress 1 เสร็จ", "locked"), action("final_present", "Final Presentation", "ทำได้หลัง Progress 2 เสร็จ", "locked"));
      } else if (p2 !== "COMPLETED") {
        result.read_only_history.push(action("progress_1", "Progress 1", "ดูย้อนหลัง", "history", "/student/schedule"));
        result.available_now.push(action("progress_2", "Progress 2", "ดำเนินการ Progress 2 ได้ตอนนี้", "available", "/student/schedule"));
        result.locked_future.push(action("final_present", "Final Presentation", "ทำได้หลัง Progress 2 เสร็จ", "locked"));
      } else if (final !== "COMPLETED") {
        result.read_only_history.push(action("progress_1", "Progress 1", "ดูย้อนหลัง", "history", "/student/schedule"), action("progress_2", "Progress 2", "ดูย้อนหลัง", "history", "/student/schedule"));
        result.available_now.push(action("final_present", "Final Presentation", "ดำเนินการ Final Presentation ได้ตอนนี้", "available", "/student/schedule"));
      }
      break;
    }
    case "FINAL_DONE":
      result.read_only_history.push(action("progress_final", "Progress/Final", "ดูผลย้อนหลัง", "history", "/student/schedule"));
      result.available_now.push(action("report", "ส่งเล่มรายงาน", "เริ่ม report approval loop", "available", "/student/report"));
      break;
    case "REPORT_REVIEW":
      if (reportStatus === "REVISION_REQUIRED") {
        result.available_now.push(action("report_revision", "ส่งรายงาน version ใหม่", "ส่งได้เมื่อ reviewer ให้แก้ไข", "available", "/student/report"));
      }
      result.read_only_history.push(action("report_versions", "ประวัติรายงานและ comment", "ดู version ที่ส่งแล้ว", "history", "/student/report"));
      result.blocked_waiting_for.push(action("waiting_report_review", "รอ reviewer ตรวจเล่ม", "แก้ไขได้เมื่อมีผลให้ปรับปรุง", "blocked"));
      break;
    case "ADVISOR_SCORING":
      result.read_only_history.push(action("status_comments", "ดูสถานะและ comment", "นักศึกษาไม่มีรายการแก้ไขในขั้นนี้", "history", "/student/report"));
      result.blocked_waiting_for.push(action("waiting_admin_closeout", "รอปิดงานโดยผู้ดูแลระบบ", "Admin จะตรวจสอบคะแนนและเล่มรายงานครบก่อนปิดงาน", "blocked"));
      break;
    case "COMPLETED":
      result.read_only_history.push(action("all_history", "ประวัติการดำเนินงานทั้งหมด", "โครงงานเสร็จสมบูรณ์", "history", "/student"));
      break;
    default:
      result.blocked_waiting_for.push(action("unknown", "รอสถานะจากระบบ", "ยังไม่มี action ที่เปิดให้ทำ", "blocked"));
  }

  return result;
}

export function getAssessmentCardState(
  assessment: "PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENT",
  status?: ProjectStatus | null,
  completed: Partial<Record<"PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENT", boolean>> = {},
  scheduleStatus?: "NONE" | "PROPOSED" | "CONFIRMED" | "REJECTED",
  submitted = false
) {
  if (status !== "IN_PROGRESS" && status !== "FINAL_DONE" && status !== "COMPLETED") {
    return { label: "ยังไม่ถึงขั้นตอน", buttonLabel: "ล็อก", editable: false };
  }
  if (completed[assessment] || status === "FINAL_DONE" || status === "COMPLETED") {
    return { label: "ดูย้อนหลัง", buttonLabel: "ดู feedback", editable: false };
  }
  const previousDone =
    assessment === "PROGRESS_1" ||
    (assessment === "PROGRESS_2" && completed.PROGRESS_1) ||
    (assessment === "FINAL_PRESENT" && completed.PROGRESS_1 && completed.PROGRESS_2);
  if (!previousDone) return { label: "ยังไม่ถึงขั้นตอน", buttonLabel: "ล็อก", editable: false };
  if (scheduleStatus === "PROPOSED") return { label: "รอกรรมการอนุมัติวันสอบ", buttonLabel: "ดูสถานะ", editable: false };
  if (scheduleStatus === "CONFIRMED" && !submitted) return { label: "นัดสอบสำเร็จ", buttonLabel: "ส่งเอกสาร", editable: true };
  if (submitted) return { label: "ส่งเอกสารแล้ว", buttonLabel: "ดูย้อนหลัง", editable: false };
  return { label: "ดำเนินการได้ตอนนี้", buttonLabel: "เสนอวันสอบ", editable: true };
}

export function getNextActionForStudent(status?: ProjectStatus | null): NextAction {
  switch (status) {
    case "STUDENT_PROFILE":
      return {
        title: "กรุณากรอกข้อมูลนักศึกษาให้ครบก่อนสร้างโปรเจค",
        description: "ข้อมูลนี้ใช้ระบุตัวตนและติดต่อระหว่างการทำโครงงาน",
        actionLabel: "กรอกข้อมูลนักศึกษา",
        href: "/student/profile"
      };
    case "DRAFT":
      return {
        title: "กรุณาเลือกอาจารย์ที่ปรึกษา",
        description: "สร้างหรือแก้ไขหัวข้อ แล้วส่งคำขอให้อาจารย์ที่ปรึกษาอนุมัติ",
        actionLabel: "สร้าง/แก้ไขโปรเจค",
        href: "/student/project"
      };
    case "PENDING_ADVISOR":
      return {
        title: "รออาจารย์ที่ปรึกษาอนุมัติ",
        description: "ยังไปขั้นตอนถัดไปไม่ได้จนกว่า advisor จะอนุมัติ หากรอเกิน 7 วันระบบจะแจ้งเตือน",
        tone: "warning"
      };
    case "PENDING_ADMIN":
      return {
        title: "รอผู้ดูแลระบบยืนยัน",
        description: "อาจารย์ที่ปรึกษาอนุมัติแล้ว ขั้นนี้ไม่ต้องดำเนินการเพิ่มเติม",
        tone: "warning"
      };
    case "PROPOSAL_PENDING":
      return {
        title: "กรุณาแนบ abstract และลิงก์ Google Drive สำหรับ Proposal",
        description: "เตรียม abstract และสไลด์สำหรับสอบหัวข้อ",
        actionLabel: "ส่งข้อมูล Proposal",
        href: "/student/proposal"
      };
    case "PROPOSAL_REVIEW":
      return {
        title: "Proposal อยู่ระหว่างประเมิน",
        description: "อาจารย์สามารถให้ comment ได้ทันที คะแนน Proposal จะไม่แสดงให้นักศึกษาเห็น",
        href: "/student/proposal",
        actionLabel: "ดู comment"
      };
    case "PROPOSAL_ADMIN_DECISION":
      return {
        title: "รอผู้ดูแลระบบตัดสินผลสอบหัวข้อ",
        description: "ระบบเก็บคะแนนและ vote ไว้แล้ว แต่ผลสุดท้ายต้องยืนยันโดยผู้ดูแลระบบ",
        tone: "warning"
      };
    case "TOPIC_APPROVED":
      return {
        title: "หัวข้อผ่านแล้ว รอแต่งตั้ง HEAD และ MEMBER",
        description: "Advisor จะเป็นบทบาท ADVISOR อัตโนมัติ หลังแต่งตั้งกรรมการแล้วจะเข้าสู่การทำโครงงาน",
        tone: "success"
      };
    case "IN_PROGRESS":
      return {
        title: "เสนอวันสอบและแนบเอกสารสำหรับ Progress/Final",
        description: "เลือก Progress 1, Progress 2 หรือ Final แล้วเสนอวัน เวลา ห้อง และลิงก์เอกสาร",
        actionLabel: "เสนอวันสอบ",
        href: "/student/schedule"
      };
    case "FINAL_DONE":
    case "REPORT_REVIEW":
      return {
        title: "ส่งเล่มรายงาน version ใหม่",
        description: "ต้องใช้ลิงก์ Google Drive ใหม่ทุก version และรอ reviewer ให้ PASS ครบ",
        actionLabel: "ส่งเล่มรายงาน",
        href: "/student/report"
      };
    case "REPORT_APPROVED":
      return {
        title: "รอ Advisor score 25%",
        description: "เล่มรายงานผ่านแล้ว ขั้นถัดไปคืออาจารย์ที่ปรึกษาบันทึก Advisor score 25%",
        tone: "warning"
      };
    case "ADVISOR_SCORING":
      return {
        title: "รอปิดงานโดยผู้ดูแลระบบ",
        description: "Admin จะตรวจสอบ Progress 1, Progress 2, Final, เล่มรายงาน และ Advisor score ก่อนปิดงานเป็น COMPLETED",
        tone: "warning"
      };
    case "COMPLETED":
      return {
        title: "โครงงานเสร็จสมบูรณ์",
        description: "ระบบเก็บประวัติและหลักฐานสำคัญไว้แล้ว",
        tone: "success"
      };
    default:
      return {
        title: "ยังไม่มีโปรเจคที่พร้อมดำเนินการ",
        description: "หากเพิ่งเข้าสู่ระบบ กรุณาติดต่อผู้ดูแลระบบให้นำเข้าข้อมูลนักศึกษา"
      };
  }
}

export type TeacherTaskCounts = {
  pendingAdvisorRequests: number;
  pendingProposalScores: number;
  pendingScheduleApprovals: number;
  pendingReportReviews: number;
  progress1ScoreReady?: number;
  progress2ScoreReady?: number;
  finalScoreReady?: number;
  advisorScoreUnlocked: boolean;
};

export function getNextActionForTeacher(tasks: TeacherTaskCounts): NextAction {
  if (tasks.pendingAdvisorRequests > 0) {
    return { title: "มีคำขอที่ปรึกษารออนุมัติ", description: "ตรวจหัวข้อและตอบรับหรือปฏิเสธพร้อมเหตุผล", href: "/teacher/advisor-requests" };
  }
  if (tasks.pendingProposalScores > 0) {
    return { title: "มี Proposal รอประเมิน", description: "อ่าน abstract และเอกสารแนบก่อนประเมิน", href: "/teacher/proposals" };
  }
  if (tasks.pendingScheduleApprovals > 0) {
    return { title: "กรรมการยังอนุมัติวันสอบไม่ครบ", description: "กรุณา approve/reject วันสอบที่นักศึกษาเสนอ", href: "/teacher/schedules", tone: "warning" };
  }
  if ((tasks.progress1ScoreReady ?? 0) > 0) {
    return { title: "มี Progress 1 พร้อมให้คะแนน", description: "วันสอบได้รับการยืนยันครบแล้ว หลังสอบให้บันทึกคะแนน Progress 1", href: "/teacher/progress1" };
  }
  if ((tasks.progress2ScoreReady ?? 0) > 0) {
    return { title: "มี Progress 2 พร้อมให้คะแนน", description: "วันสอบได้รับการยืนยันครบแล้ว หลังสอบให้บันทึกคะแนน Progress 2", href: "/teacher/progress2" };
  }
  if ((tasks.finalScoreReady ?? 0) > 0) {
    return { title: "มี Final Presentation พร้อมให้คะแนน", description: "วันสอบได้รับการยืนยันครบแล้ว หลังสอบให้บันทึกคะแนน Final Presentation", href: "/teacher/final" };
  }
  if (tasks.pendingReportReviews > 0) {
    return { title: "มีเล่มรายงานรอตรวจ", description: "ให้ PASS หรือ FAIL พร้อม comment", href: "/teacher/reports" };
  }
  if (tasks.advisorScoreUnlocked) {
    return { title: "คะแนน Advisor 25% พร้อมให้กรอก", description: "เล่มผ่านครบและพร้อมบันทึกคะแนนอาจารย์ที่ปรึกษา", href: "/teacher/advisor-score", tone: "success" };
  }
  return { title: "ยังไม่มีงานที่ต้องดำเนินการ", description: "งานใหม่จะแสดงที่นี่เมื่อมีคำขอหรือรอบประเมิน", tone: "success" };
}

export type AdminProjectLike = {
  status: ProjectStatus;
  proposalVotes?: Array<{ vote: "PASS" | "REVISE" | "FAIL" }>;
};

export function getNextActionForAdmin(projects: AdminProjectLike[]): NextAction {
  if (projects.some((project) => project.status === "PENDING_ADMIN")) {
    return { title: "มี project รอ Admin ยืนยัน", description: "ตรวจ advisor และข้อมูลโครงงานก่อนส่งเข้าสู่ Proposal", href: "/admin" };
  }
  if (projects.some((project) => project.status === "PROPOSAL_ADMIN_DECISION")) {
    return { title: "มี Proposal รอ Admin ตัดสินผล", description: "อาจารย์ส่งคะแนนแล้ว กรุณาตรวจคะแนน/comment แล้วบันทึก final decision", href: "/admin/proposals", tone: "warning" };
  }
  if (projects.some((project) => shouldAlertAdminForFailVotes(project.proposalVotes ?? []))) {
    return { title: "มี Proposal ที่ FAIL ≥ 50%", description: "ระบบไม่ตัดสินผลอัตโนมัติ กรุณาตรวจ vote และ comment อย่างละเอียด", href: "/admin/proposals", tone: "warning" };
  }
  if (projects.some((project) => project.status === "TOPIC_APPROVED")) {
    return { title: "พร้อมแต่งตั้ง HEAD และ MEMBER", description: "หัวข้อผ่านแล้ว ต้องตั้งคณะกรรมการก่อนเข้าสู่ IN_PROGRESS", href: "/admin/committee" };
  }
  if (projects.some((project) => project.status === "ADVISOR_SCORING")) {
    return { title: "มี project รอปิดงาน", description: "ตรวจสอบคะแนน Progress/Final, เล่มรายงาน และ Advisor score ก่อนเปลี่ยนเป็น COMPLETED", href: "/admin/closeout" };
  }
  if (projects.some((project) => project.status === "REPORT_APPROVED")) {
    return { title: "Report ผ่านแล้ว รอ Advisor score", description: "ติดตาม advisor final gate ก่อนเข้าสู่หน้า closeout", href: "/admin/closeout" };
  }
  return { title: "ภาพรวมระบบเรียบร้อย", description: "ยังไม่มีงานเร่งด่วนสำหรับผู้ดูแลระบบ", tone: "success" };
}
