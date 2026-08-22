import type { AttemptType, Decision, ProjectStatus } from "@prisma/client";
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

export type StudentAssessmentRoundKey = "PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENT";

export type StudentWorkflowContext = {
  proposalRoundOpen?: boolean;
  proposalRevisionSubmitted?: boolean;
  proposal?: ProposalStudentActionContext;
  roundAvailability?: Partial<Record<StudentAssessmentRoundKey, boolean>>;
};

export type ProposalStudentActionContext = {
  latestAttemptNo?: number | null;
  latestAttemptType?: AttemptType | null;
  latestResultAttemptNo?: number | null;
  latestDecision?: Decision | null;
};

export function getProposalStudentNextAction(
  status?: ProjectStatus | null,
  context: ProposalStudentActionContext = {}
): NextAction | null {
  const latestAttemptNo = context.latestAttemptNo && context.latestAttemptNo > 0
    ? context.latestAttemptNo
    : null;
  const latestResultMatchesAttempt = Boolean(
    latestAttemptNo
    && context.latestResultAttemptNo === latestAttemptNo
  );
  const preparingAfterNotPass = context.latestDecision === "NOT_PASS"
    && (context.latestResultAttemptNo == null || latestResultMatchesAttempt);
  const hasReproposalAttempt = context.latestAttemptType === "REPROPOSAL";
  const isPreparingNextAttempt = ["DRAFT", "PENDING_ADVISOR", "PENDING_ADMIN", "PROPOSAL_PENDING"].includes(status ?? "");
  const isReviewingReproposal = ["PROPOSAL_REVIEW", "PROPOSAL_ADMIN_DECISION"].includes(status ?? "");

  if (isPreparingNextAttempt && !preparingAfterNotPass) return null;
  if (isReviewingReproposal && !hasReproposalAttempt) return null;
  if (!isPreparingNextAttempt && !isReviewingReproposal) return null;

  switch (status) {
    case "DRAFT":
      return {
        title: "เริ่มเตรียมการสอบหัวข้อครั้งถัดไป",
        description: "กรอกหัวข้อโครงงานใหม่ เลือกอาจารย์ที่ปรึกษา และส่งคำขอเพื่อเริ่มกระบวนการสอบหัวข้อครั้งถัดไป",
        actionLabel: "กรอกหัวข้อโครงงานใหม่",
        href: "/student/project"
      };
    case "PENDING_ADVISOR":
      return {
        title: "รออาจารย์ที่ปรึกษาพิจารณาหัวข้อใหม่",
        description: "ส่งคำขอสำหรับการสอบหัวข้อครั้งถัดไปแล้ว เมื่ออาจารย์ที่ปรึกษาอนุมัติ ระบบจะส่งต่อให้ผู้ดูแลระบบยืนยัน",
        tone: "warning"
      };
    case "PENDING_ADMIN":
      return {
        title: "รอผู้ดูแลระบบอนุมัติหัวข้อและที่ปรึกษา",
        description: "อาจารย์ที่ปรึกษาอนุมัติหัวข้อใหม่แล้ว ขั้นนี้นักศึกษาไม่ต้องดำเนินการเพิ่มเติม",
        tone: "warning"
      };
    case "PROPOSAL_PENDING":
      return {
        title: "พร้อมส่ง Proposal สำหรับการสอบหัวข้อครั้งถัดไป",
        description: "หัวข้อใหม่และอาจารย์ที่ปรึกษาได้รับการอนุมัติแล้ว กรุณาตรวจสอบข้อมูลและส่ง Proposal ฉบับใหม่เพื่อเข้าสู่การประเมินอีกครั้ง ผลการสอบครั้งก่อนทั้งหมดจะถูกเก็บไว้เป็นประวัติ",
        actionLabel: "กรอกและส่ง Proposal ฉบับใหม่",
        href: "/student/proposal"
      };
    case "PROPOSAL_REVIEW":
      return {
        title: "ส่ง Proposal ฉบับใหม่แล้ว",
        description: "ระบบบันทึก Proposal สำหรับการสอบหัวข้อรอบใหม่แล้ว ขณะนี้อยู่ระหว่างรออาจารย์ประเมิน โดยผลการสอบครั้งก่อนยังคงอยู่ในประวัติ",
        actionLabel: "ดูสถานะ Proposal",
        href: "/student/proposal",
        tone: "success"
      };
    case "PROPOSAL_ADMIN_DECISION":
      return {
        title: "รอบันทึกมติการสอบหัวข้อรอบใหม่",
        description: "อาจารย์ประเมินแล้ว ขณะนี้อยู่ระหว่างรอผู้ดูแลระบบบันทึกมติของการสอบหัวข้อรอบนี้",
        actionLabel: "ดูสถานะ Proposal",
        href: "/student/proposal",
        tone: "warning"
      };
    default:
      return null;
  }
}

function action(
  key: string,
  title: string,
  description: string,
  state: StudentWorkflowAction["state"],
  href?: string
): StudentWorkflowAction {
  return { key, title, description, state, href };
}

function roundWaitingAction(key: StudentAssessmentRoundKey): StudentWorkflowAction {
  if (key === "PROGRESS_1") {
    return action("progress_1_round_closed", "รอผู้ดูแลระบบเปิดรอบความก้าวหน้าครั้งที่ 1", "ยังไม่สามารถบันทึกหลักฐานหรือเสนอวันสอบความก้าวหน้าครั้งที่ 1 ได้จนกว่ารอบสอบจะเปิด", "blocked");
  }
  if (key === "PROGRESS_2") {
    return action("progress_2_round_closed", "รอผู้ดูแลระบบเปิดรอบความก้าวหน้าครั้งที่ 2", "ความก้าวหน้าครั้งที่ 1 เสร็จแล้ว แต่ยังต้องรอผู้ดูแลระบบเปิดรอบความก้าวหน้าครั้งที่ 2", "blocked");
  }
  return action("final_present_round_closed", "รอผู้ดูแลระบบเปิดรอบสอบนำเสนอขั้นสุดท้าย", "ความก้าวหน้าครั้งที่ 1 และ 2 เสร็จแล้ว แต่ยังต้องรอผู้ดูแลระบบเปิดรอบสอบนำเสนอขั้นสุดท้าย", "blocked");
}

export function getStudentAvailableActions(
  status?: ProjectStatus | null,
  assessments: Partial<Record<"PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENT", "NOT_STARTED" | "SCHEDULED" | "SUBMITTED" | "COMPLETED">> = {},
  reportStatus?: "NONE" | "REVISION_REQUIRED" | "SUBMITTED" | "APPROVED",
  context: StudentWorkflowContext = {}
): StudentAvailableActions {
  const result: StudentAvailableActions = {
    available_now: [],
    read_only_history: [],
    locked_future: [],
    blocked_waiting_for: []
  };
  const roundIsOpen = (key: StudentAssessmentRoundKey) => context.roundAvailability?.[key] ?? true;
  const lockFuture = () => {
    result.locked_future.push(
      action("proposal", "เอกสารเสนอหัวข้อ", "ยังไม่ถึงขั้นตอนส่งเอกสารเสนอหัวข้อ", "locked"),
      action("progress_1", "สอบความก้าวหน้าครั้งที่ 1", "ยังไม่ถึงขั้นตอนสอบความก้าวหน้าครั้งที่ 1", "locked"),
      action("progress_2", "สอบความก้าวหน้าครั้งที่ 2", "ยังไม่ถึงขั้นตอนสอบความก้าวหน้าครั้งที่ 2", "locked"),
      action("final_present", "สอบนำเสนอขั้นสุดท้าย", "ยังไม่ถึงขั้นตอนสอบนำเสนอขั้นสุดท้าย", "locked"),
      action("report", "รายงาน", "ยังไม่ถึงขั้นตอนส่งเล่มรายงาน", "locked")
    );
  };

  const proposalNextAction = getProposalStudentNextAction(status, context.proposal);
  if (proposalNextAction) {
    switch (status) {
      case "DRAFT":
        result.available_now.push(action("reproposal_project", proposalNextAction.title, proposalNextAction.description, "available", proposalNextAction.href));
        result.locked_future.push(
          action("proposal", "Proposal สำหรับการสอบหัวข้อครั้งถัดไป", "ส่งได้หลังอาจารย์ที่ปรึกษาและผู้ดูแลระบบยืนยัน", "locked"),
          action("progress_1", "สอบความก้าวหน้าครั้งที่ 1", "ยังไม่ถึงขั้นตอน", "locked")
        );
        return result;
      case "PENDING_ADVISOR":
        result.available_now.push(action("view_project", "ดูข้อมูลโครงงานใหม่", "ตรวจสอบคำขอที่ส่งแล้ว", "available", "/student/project"));
        result.blocked_waiting_for.push(action("waiting_reproposal_advisor", proposalNextAction.title, proposalNextAction.description, "blocked"));
        return result;
      case "PENDING_ADMIN":
        result.available_now.push(action("view_status", "ดูสถานะ", "ยังไม่มีรายการที่ต้องแก้ไข", "available", "/student"));
        result.blocked_waiting_for.push(action("waiting_reproposal_admin", proposalNextAction.title, proposalNextAction.description, "blocked"));
        return result;
      case "PROPOSAL_PENDING":
        result.available_now.push(action("reproposal", proposalNextAction.title, proposalNextAction.description, "available", proposalNextAction.href));
        result.read_only_history.push(action("previous_proposal", "ผลการสอบหัวข้อครั้งก่อน", "เก็บไว้เป็นประวัติและไม่ถูกแก้ไข", "history", "/student/proposal"));
        result.locked_future.push(action("progress_1", "สอบความก้าวหน้าครั้งที่ 1", "รอผลการสอบหัวข้อรอบใหม่", "locked"));
        return result;
      case "PROPOSAL_REVIEW":
      case "PROPOSAL_ADMIN_DECISION":
        result.read_only_history.push(action("reproposal", "Proposal สำหรับการสอบหัวข้อรอบใหม่", "ส่งแล้ว ดูสถานะและข้อเสนอแนะได้", "history", "/student/proposal"));
        result.blocked_waiting_for.push(action("waiting_reproposal_decision", proposalNextAction.title, proposalNextAction.description, "blocked"));
        result.locked_future.push(action("progress_1", "สอบความก้าวหน้าครั้งที่ 1", "รอผลการสอบหัวข้อรอบใหม่", "locked"));
        return result;
      default:
        break;
    }
  }

  switch (status) {
    case "STUDENT_PROFILE":
      result.available_now.push(action("student_profile", "กรอกข้อมูลนักศึกษา", "ทำขั้นตอนนี้ก่อนสร้างโครงงาน", "available", "/student/profile"));
      lockFuture();
      break;
    case "DRAFT":
      result.available_now.push(
        action("project", "สร้าง/แก้ไขข้อมูลโครงงาน", "ระบุหัวข้อ เลือกที่ปรึกษา และส่งคำขอ", "available", "/student/project")
      );
      result.locked_future.push(
        action("proposal", "เอกสารเสนอหัวข้อ", "ส่งได้หลังอาจารย์ที่ปรึกษาและผู้ดูแลระบบยืนยัน", "locked"),
        action("progress_1", "สอบความก้าวหน้าครั้งที่ 1", "ยังไม่ถึงขั้นตอน", "locked"),
        action("progress_2", "สอบความก้าวหน้าครั้งที่ 2", "ยังไม่ถึงขั้นตอน", "locked"),
        action("final_present", "สอบนำเสนอขั้นสุดท้าย", "ยังไม่ถึงขั้นตอน", "locked"),
        action("report", "รายงาน", "ยังไม่ถึงขั้นตอน", "locked")
      );
      break;
    case "PENDING_ADVISOR":
      result.available_now.push(action("view_project", "ดูข้อมูลโครงงาน", "ตรวจสอบคำขอที่ส่งแล้ว", "available", "/student/project"));
      result.read_only_history.push(action("advisor_request", "รายละเอียดคำขอที่ปรึกษา", "คำขอถูกส่งแล้ว", "history", "/student/project"));
      result.blocked_waiting_for.push(action("waiting_advisor", "รออาจารย์ที่ปรึกษาอนุมัติ", "ยังส่งเอกสารเสนอหัวข้อไม่ได้", "blocked"));
      break;
    case "PENDING_ADMIN":
      result.available_now.push(action("view_status", "ดูสถานะ", "ยังไม่มีรายการที่ต้องแก้ไข", "available", "/student"));
      result.blocked_waiting_for.push(action("waiting_admin", "รอผู้ดูแลระบบยืนยัน", "ผู้ดูแลระบบต้องยืนยันโครงงานและอาจารย์ที่ปรึกษา", "blocked"));
      break;
    case "PROPOSAL_PENDING":
      if (context.proposalRoundOpen === false) {
        result.blocked_waiting_for.push(action("proposal_round_closed", "รอบส่ง Proposal ครั้งแรกสิ้นสุดแล้ว", "หากยังไม่เคยส่ง Proposal กรุณาติดต่ออาจารย์ผู้รับผิดชอบหรือผู้ดูแลระบบเพื่อพิจารณาเปิดให้ส่งเป็นรายกรณี", "blocked"));
        break;
      }
      result.available_now.push(action("proposal", "ส่งเอกสารเสนอหัวข้อ", "แนบบทคัดย่อและลิงก์เอกสารประกอบ", "available", "/student/proposal"));
      result.read_only_history.push(action("project", "ข้อมูลโครงงาน", "ส่งคำขอที่ปรึกษาแล้ว", "history", "/student/project"));
      result.locked_future.push(action("progress_1", "สอบความก้าวหน้าครั้งที่ 1", "รอผลการเสนอหัวข้อ", "locked"), action("report", "รายงาน", "ยังไม่ถึงขั้นตอน", "locked"));
      break;
    case "PROPOSAL_REVIEW":
    case "PROPOSAL_ADMIN_DECISION":
      result.read_only_history.push(action("proposal", "เอกสารเสนอหัวข้อ", "ส่งแล้ว ดูข้อเสนอแนะได้", "history", "/student/proposal"));
      result.blocked_waiting_for.push(action("waiting_proposal_decision", "รอการตัดสินผลสอบหัวข้อ", "ยังแก้ไขเอกสารเสนอหัวข้อไม่ได้ เว้นแต่ผู้ดูแลระบบเปิดสิทธิ์", "blocked"));
      result.locked_future.push(action("progress_1", "สอบความก้าวหน้าครั้งที่ 1", "รอผลการเสนอหัวข้อ", "locked"), action("report", "รายงาน", "ยังไม่ถึงขั้นตอน", "locked"));
      break;
    case "PROPOSAL_REVISION_REQUIRED":
      if (context.proposalRevisionSubmitted) {
        result.read_only_history.push(action("proposal_revision", "Proposal ฉบับแก้ไข", "ส่งฉบับแก้ไขให้ที่ปรึกษาแล้ว", "history", "/student/proposal"));
      } else {
        result.available_now.push(action("proposal_revision", "แก้ไข Proposal ตามมติ", "ส่งฉบับแก้ไขให้ที่ปรึกษารับรองโดยไม่สอบใหม่", "available", "/student/proposal"));
      }
      result.blocked_waiting_for.push(action("waiting_revision_approval", "รอที่ปรึกษารับรอง", "ขั้นแต่งตั้งกรรมการจะเปิดหลังที่ปรึกษารับรองฉบับแก้ไข", "blocked"));
      result.locked_future.push(action("progress_1", "สอบความก้าวหน้าครั้งที่ 1", "รอที่ปรึกษารับรอง Proposal ฉบับแก้ไข", "locked"));
      break;
    case "TOPIC_APPROVED":
      result.read_only_history.push(action("proposal", "การเสนอหัวข้อผ่านแล้ว", "ดูข้อมูลย้อนหลังได้", "history", "/student/proposal"));
      result.available_now.push(action("committee", "ดูการแต่งตั้งกรรมการ", "รอผู้ดูแลระบบแต่งตั้งประธานและกรรมการ", "available", "/student/schedule"));
      result.locked_future.push(action("progress_1", "สอบความก้าวหน้าครั้งที่ 1", "เสนอวันสอบได้หลังกรรมการพร้อม", "locked"));
      break;
    case "IN_PROGRESS": {
      result.read_only_history.push(action("proposal", "เอกสารเสนอหัวข้อ", "ดูย้อนหลัง", "history", "/student/proposal"));
      const p1 = assessments.PROGRESS_1;
      const p2 = assessments.PROGRESS_2;
      const final = assessments.FINAL_PRESENT;
      if (p1 !== "COMPLETED") {
        result.available_now.push(action("progress_1", "สอบความก้าวหน้าครั้งที่ 1", "ดำเนินการสอบความก้าวหน้าครั้งที่ 1 ได้ตอนนี้", "available", "/student/schedule"));
        result.locked_future.push(action("progress_2", "สอบความก้าวหน้าครั้งที่ 2", "ทำได้หลังสอบความก้าวหน้าครั้งที่ 1 เสร็จ", "locked"), action("final_present", "สอบนำเสนอขั้นสุดท้าย", "ทำได้หลังสอบความก้าวหน้าครั้งที่ 2 เสร็จ", "locked"));
      } else if (p2 !== "COMPLETED") {
        result.read_only_history.push(action("progress_1", "สอบความก้าวหน้าครั้งที่ 1", "ดูย้อนหลัง", "history", "/student/schedule"));
        result.available_now.push(action("progress_2", "สอบความก้าวหน้าครั้งที่ 2", "ดำเนินการสอบความก้าวหน้าครั้งที่ 2 ได้ตอนนี้", "available", "/student/schedule"));
        result.locked_future.push(action("final_present", "สอบนำเสนอขั้นสุดท้าย", "ทำได้หลังสอบความก้าวหน้าครั้งที่ 2 เสร็จ", "locked"));
      } else if (final !== "COMPLETED") {
        result.read_only_history.push(action("progress_1", "สอบความก้าวหน้าครั้งที่ 1", "ดูย้อนหลัง", "history", "/student/schedule"), action("progress_2", "สอบความก้าวหน้าครั้งที่ 2", "ดูย้อนหลัง", "history", "/student/schedule"));
        result.available_now.push(action("final_present", "สอบนำเสนอขั้นสุดท้าย", "ดำเนินการสอบนำเสนอขั้นสุดท้ายได้ตอนนี้", "available", "/student/schedule"));
      } else {
        result.read_only_history.push(
          action("progress_1", "สอบความก้าวหน้าครั้งที่ 1", "ดูย้อนหลัง", "history", "/student/schedule"),
          action("progress_2", "สอบความก้าวหน้าครั้งที่ 2", "ดูย้อนหลัง", "history", "/student/schedule"),
          action("final_present", "สอบนำเสนอขั้นสุดท้าย", "ดูย้อนหลัง", "history", "/student/schedule")
        );
        result.available_now.push(action("report", "ส่งเล่มรายงานฉบับสมบูรณ์", "หลังการสอบนำเสนอขั้นสุดท้าย ให้แก้เล่มตามข้อเสนอแนะ แล้วส่งเล่มให้ที่ปรึกษาและกรรมการตรวจ", "available", "/student/report"));
      }
      break;
    }
    case "FINAL_DONE":
      result.read_only_history.push(action("progress_final", "ผลการสอบความก้าวหน้า/สอบขั้นสุดท้าย", "ดูผลย้อนหลัง", "history", "/student/schedule"));
      result.available_now.push(action("report", "ส่งเล่มรายงานฉบับสมบูรณ์", "ส่งเล่มรายงานครั้งแรกหลังการสอบนำเสนอขั้นสุดท้ายเสร็จสมบูรณ์", "available", "/student/report"));
      break;
    case "REPORT_REVIEW":
      if (reportStatus === "REVISION_REQUIRED") {
        result.available_now.push(action("report_revision", "แก้ไขเล่มรายงานตามข้อเสนอแนะของผู้ตรวจ และส่งฉบับใหม่", "ส่งได้เมื่อผู้ตรวจขอแก้ไขเล่มรายงาน", "available", "/student/report"));
      }
      result.read_only_history.push(action("report_versions", "ประวัติรายงานและข้อเสนอแนะ", "ดูฉบับรายงานที่ส่งแล้ว", "history", "/student/report"));
      result.blocked_waiting_for.push(action("waiting_report_review", "รอผู้ตรวจรายงานพิจารณา", "แก้ไขได้เมื่อมีผลให้ปรับปรุง", "blocked"));
      break;
    case "ADVISOR_SCORING":
      result.read_only_history.push(action("status_comments", "ดูสถานะและข้อเสนอแนะ", "นักศึกษาไม่มีรายการแก้ไขในขั้นนี้", "history", "/student/report"));
      result.blocked_waiting_for.push(action("waiting_admin_closeout", "รอผู้ดูแลระบบยืนยันจบโครงงาน", "ผู้ดูแลระบบจะตรวจสอบคะแนนและเล่มรายงานครบก่อนยืนยันจบโครงงาน", "blocked"));
      break;
    case "COMPLETED":
      result.read_only_history.push(action("all_history", "ประวัติการดำเนินงานทั้งหมด", "โครงงานเสร็จสมบูรณ์", "history", "/student"));
      break;
    default:
      result.blocked_waiting_for.push(action("unknown", "รอสถานะจากระบบ", "ยังไม่มี action ที่เปิดให้ทำ", "blocked"));
  }

  if (status === "IN_PROGRESS") {
    const blockRoundIfClosed = (roundKey: StudentAssessmentRoundKey, availableKey: string) => {
      if (roundIsOpen(roundKey)) return;
      const before = result.available_now.length;
      result.available_now = result.available_now.filter((item) => item.key !== availableKey);
      if (result.available_now.length !== before) result.blocked_waiting_for.push(roundWaitingAction(roundKey));
    };
    blockRoundIfClosed("PROGRESS_1", "progress_1");
    blockRoundIfClosed("PROGRESS_2", "progress_2");
    blockRoundIfClosed("FINAL_PRESENT", "final_present");
  }

  return result;
}

export function getAssessmentCardState(
  assessment: "PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENT",
  status?: ProjectStatus | null,
  completed: Partial<Record<"PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENT", boolean>> = {},
  scheduleStatus?: "NONE" | "PROPOSED" | "CONFIRMED" | "REJECTED",
  submitted = false,
  roundOpen = true
) {
  if (!roundOpen && status === "IN_PROGRESS" && !completed[assessment]) {
    return { label: "รอเปิดรอบสอบ", buttonLabel: "ล็อก", editable: false };
  }
  if (status !== "IN_PROGRESS" && status !== "FINAL_DONE" && status !== "COMPLETED") {
    return { label: "ยังไม่ถึงขั้นตอน", buttonLabel: "ล็อก", editable: false };
  }
  if (completed[assessment] || status === "FINAL_DONE" || status === "COMPLETED") {
    return { label: "ดูย้อนหลัง", buttonLabel: "ดูข้อเสนอแนะ", editable: false };
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
        title: "กรุณากรอกข้อมูลนักศึกษาให้ครบก่อนสร้างโครงงาน",
        description: "ข้อมูลนี้ใช้ระบุตัวตนและติดต่อระหว่างการทำโครงงาน",
        actionLabel: "กรอกข้อมูลนักศึกษา",
        href: "/student/profile"
      };
    case "DRAFT":
      return {
        title: "กรุณาเลือกอาจารย์ที่ปรึกษา",
        description: "สร้างหรือแก้ไขหัวข้อ แล้วส่งคำขอให้อาจารย์ที่ปรึกษาอนุมัติ",
        actionLabel: "สร้าง/แก้ไขโครงงาน",
        href: "/student/project"
      };
    case "PENDING_ADVISOR":
      return {
        title: "รออาจารย์ที่ปรึกษาอนุมัติ",
        description: "ยังไปขั้นตอนถัดไปไม่ได้จนกว่าอาจารย์ที่ปรึกษาจะอนุมัติ หากรอเกิน 7 วันระบบจะแจ้งเตือน",
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
        title: "กรุณาแนบบทคัดย่อและลิงก์เอกสารเสนอหัวข้อ",
        description: "เตรียม abstract และสไลด์สำหรับสอบหัวข้อ",
        actionLabel: "ส่งเอกสารเสนอหัวข้อ",
        href: "/student/proposal"
      };
    case "PROPOSAL_REVIEW":
      return {
        title: "เอกสารเสนอหัวข้ออยู่ระหว่างประเมิน",
        description: "อาจารย์สามารถให้ข้อเสนอแนะได้ทันที คะแนนการเสนอหัวข้อจะไม่แสดงให้นักศึกษาเห็น",
        href: "/student/proposal",
        actionLabel: "ดูข้อเสนอแนะ"
      };
    case "PROPOSAL_ADMIN_DECISION":
      return {
        title: "รอผู้ดูแลระบบตัดสินผลสอบหัวข้อ",
        description: "ระบบเก็บคะแนนและผลพิจารณาไว้แล้ว แต่ผลสุดท้ายต้องยืนยันโดยผู้ดูแลระบบ",
        tone: "warning"
      };
    case "PROPOSAL_REVISION_REQUIRED":
      return {
        title: "แก้ไข Proposal ตามมติ",
        description: "ส่งฉบับแก้ไขให้ที่ปรึกษารับรอง ขั้นตอนนี้ไม่ต้องสอบหรือให้คะแนนใหม่",
        actionLabel: "แก้ไข Proposal",
        href: "/student/proposal",
        tone: "warning"
      };
    case "TOPIC_APPROVED":
      return {
        title: "หัวข้อผ่านแล้ว รอแต่งตั้งประธานและกรรมการ",
        description: "อาจารย์ที่ปรึกษาจะเป็นกรรมการในบทบาทที่ปรึกษาอัตโนมัติ หลังแต่งตั้งกรรมการแล้วจะเข้าสู่การทำโครงงาน",
        tone: "success"
      };
    case "IN_PROGRESS":
      return {
        title: "เสนอวันสอบและแนบเอกสารสำหรับรอบสอบ",
        description: "เลือกสอบความก้าวหน้าครั้งที่ 1 ครั้งที่ 2 หรือสอบขั้นสุดท้าย แล้วเสนอวัน เวลา ห้อง และลิงก์เอกสาร",
        actionLabel: "เสนอวันสอบ",
        href: "/student/schedule"
      };
    case "FINAL_DONE":
    case "REPORT_REVIEW":
      return {
        title: "ส่งเล่มรายงานฉบับสมบูรณ์",
        description: "ใช้ลิงก์ Google Drive ของเล่มรายงาน และรอผู้ตรวจพิจารณา",
        actionLabel: "ส่งเล่มรายงาน",
        href: "/student/report"
      };
    case "REPORT_APPROVED":
      return {
        title: "รอคะแนนสรุปของอาจารย์ที่ปรึกษา 25%",
        description: "เล่มรายงานผ่านแล้ว ขั้นถัดไปคืออาจารย์ที่ปรึกษาบันทึกคะแนนสรุป 25%",
        tone: "warning"
      };
    case "ADVISOR_SCORING":
      return {
        title: "รอปิดงานโดยผู้ดูแลระบบ",
        description: "ผู้ดูแลระบบจะตรวจสอบคะแนนสอบความก้าวหน้า คะแนนสอบขั้นสุดท้าย เล่มรายงาน และคะแนนอาจารย์ที่ปรึกษาก่อนยืนยันจบโครงงาน",
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
        title: "ยังไม่มีโครงงานที่พร้อมดำเนินการ",
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
    return { title: "มีเอกสารเสนอหัวข้อรอประเมิน", description: "อ่านบทคัดย่อและเอกสารแนบก่อนประเมิน", href: "/teacher/proposals" };
  }
  if (tasks.pendingScheduleApprovals > 0) {
    return { title: "กรรมการยังอนุมัติวันสอบไม่ครบ", description: "กรุณา approve/reject วันสอบที่นักศึกษาเสนอ", href: "/teacher/schedules", tone: "warning" };
  }
  if ((tasks.progress1ScoreReady ?? 0) > 0) {
    return { title: "มีการสอบความก้าวหน้าครั้งที่ 1 พร้อมให้คะแนน", description: "วันสอบได้รับการยืนยันครบแล้ว หลังสอบให้บันทึกคะแนนการสอบความก้าวหน้าครั้งที่ 1", href: "/teacher/progress1" };
  }
  if ((tasks.progress2ScoreReady ?? 0) > 0) {
    return { title: "มีการสอบความก้าวหน้าครั้งที่ 2 พร้อมให้คะแนน", description: "วันสอบได้รับการยืนยันครบแล้ว หลังสอบให้บันทึกคะแนนการสอบความก้าวหน้าครั้งที่ 2", href: "/teacher/progress2" };
  }
  if ((tasks.finalScoreReady ?? 0) > 0) {
    return { title: "มีการสอบนำเสนอขั้นสุดท้ายพร้อมให้คะแนน", description: "วันสอบได้รับการยืนยันครบแล้ว หลังสอบให้บันทึกคะแนนการสอบนำเสนอขั้นสุดท้าย", href: "/teacher/final" };
  }
  if (tasks.pendingReportReviews > 0) {
    return { title: "มีเล่มรายงานรอตรวจ", description: "บันทึกผลผ่านหรือขอแก้ไข พร้อมข้อเสนอแนะ", href: "/teacher/reports" };
  }
  if (tasks.advisorScoreUnlocked) {
    return { title: "คะแนนสรุปของอาจารย์ที่ปรึกษา 25% พร้อมให้กรอก", description: "เล่มผ่านครบและพร้อมบันทึกคะแนนอาจารย์ที่ปรึกษา", href: "/teacher/advisor-score", tone: "success" };
  }
  return { title: "ยังไม่มีงานที่ต้องดำเนินการ", description: "งานใหม่จะแสดงที่นี่เมื่อมีคำขอหรือรอบประเมิน", tone: "success" };
}

export type AdminProjectLike = {
  status: ProjectStatus;
  proposalVotes?: Array<{ vote: "PASS" | "REVISE" | "FAIL" }>;
};

export function getNextActionForAdmin(projects: AdminProjectLike[]): NextAction {
  if (projects.some((project) => project.status === "PENDING_ADMIN")) {
    return { title: "มีโครงงานรอผู้ดูแลระบบยืนยัน", description: "ตรวจอาจารย์ที่ปรึกษาและข้อมูลโครงงานก่อนส่งเข้าสู่รอบเสนอหัวข้อ", href: "/admin" };
  }
  if (projects.some((project) => project.status === "PROPOSAL_ADMIN_DECISION")) {
    return { title: "มีผลการเสนอหัวข้อรอผู้ดูแลระบบบันทึกมติ", description: "อาจารย์ส่งคะแนนแล้ว กรุณาตรวจคะแนนและข้อเสนอแนะก่อนบันทึกมติ", href: "/admin/proposals", tone: "warning" };
  }
  if (projects.some((project) => shouldAlertAdminForFailVotes(project.proposalVotes ?? []))) {
    return { title: "มีการเสนอหัวข้อที่ไม่ผ่านอย่างน้อย 50%", description: "ระบบไม่ตัดสินผลอัตโนมัติ กรุณาตรวจผลโหวตและข้อเสนอแนะอย่างละเอียด", href: "/admin/proposals", tone: "warning" };
  }
  if (projects.some((project) => project.status === "TOPIC_APPROVED")) {
    return { title: "พร้อมแต่งตั้งประธานและกรรมการ", description: "หัวข้อผ่านแล้ว ต้องตั้งคณะกรรมการก่อนเข้าสู่ขั้นดำเนินโครงงาน", href: "/admin/committee" };
  }
  if (projects.some((project) => project.status === "ADVISOR_SCORING")) {
    return { title: "มีโครงงานรอยืนยันจบ", description: "ตรวจสอบคะแนนสอบความก้าวหน้า คะแนนสอบขั้นสุดท้าย เล่มรายงาน และคะแนนอาจารย์ที่ปรึกษาก่อนยืนยันว่าโครงงานเสร็จสมบูรณ์", href: "/admin/closeout" };
  }
  if (projects.some((project) => project.status === "REPORT_APPROVED")) {
    return { title: "รายงานผ่านแล้ว รอคะแนนอาจารย์ที่ปรึกษา", description: "ติดตามการบันทึกคะแนนสรุปก่อนเข้าสู่ขั้นตอนยืนยันจบโครงงาน", href: "/admin/closeout" };
  }
  return { title: "ภาพรวมระบบเรียบร้อย", description: "ยังไม่มีงานเร่งด่วนสำหรับผู้ดูแลระบบ", tone: "success" };
}
