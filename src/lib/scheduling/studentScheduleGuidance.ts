export type StudentScheduleKind = "PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENT";
export type StudentScheduleStatus = "NONE" | "PROPOSED" | "CONFIRMED" | "REJECTED";

export type StudentScheduleGuidance = {
  title: string;
  description: string;
  actionLabel?: string;
  href?: string;
};

const kindSlug: Record<StudentScheduleKind, string> = {
  PROGRESS_1: "progress-1",
  PROGRESS_2: "progress-2",
  FINAL_PRESENT: "final-present"
};

const feedbackHref: Record<StudentScheduleKind, string> = {
  PROGRESS_1: "/student/feedback?round=progress-1#progress-1",
  PROGRESS_2: "/student/feedback?round=progress-2#progress-2",
  FINAL_PRESENT: "/student/feedback?round=final#final"
};

export function studentScheduleEvidenceAnchor(kind: StudentScheduleKind) {
  return `evidence-form-${kindSlug[kind]}`;
}

export function studentScheduleStatusAnchor(kind: StudentScheduleKind) {
  return `schedule-status-${kindSlug[kind]}`;
}

export function getStudentScheduleGuidance(input: {
  kind: StudentScheduleKind;
  completed: boolean;
  actionable: boolean;
  hasEvidence: boolean;
  scheduleStatus: StudentScheduleStatus;
  blockedReason?: string;
}): StudentScheduleGuidance {
  if (input.completed) {
    return {
      title: "ประเมินรอบนี้เสร็จแล้ว",
      description: "คะแนนและข้อเสนอแนะที่บันทึกแล้วเปิดอ่านได้จากหน้าผลการประเมิน",
      actionLabel: "ดูข้อเสนอแนะ",
      href: feedbackHref[input.kind]
    };
  }

  if (input.scheduleStatus === "PROPOSED" || input.scheduleStatus === "CONFIRMED") {
    return {
      title: input.scheduleStatus === "CONFIRMED" ? "ยืนยันวันสอบแล้ว" : "ส่งขอนัดแล้ว",
      description: input.scheduleStatus === "CONFIRMED"
        ? "วันสอบได้รับการยืนยันแล้ว เปิดดูวัน เวลา ห้องสอบ และสถานะกรรมการได้"
        : "คำขอนัดสอบถูกส่งแล้ว เปิดดูจำนวนกรรมการที่อนุมัติและสถานะล่าสุดได้",
      actionLabel: "ดูสถานะวันสอบ",
      href: `#${studentScheduleStatusAnchor(input.kind)}`
    };
  }

  if (!input.actionable) {
    return {
      title: input.blockedReason ?? "ยังไม่พร้อมดำเนินการ",
      description: "ขั้นตอนนี้ยังไม่เปิดให้บันทึกหลักฐานหรือเสนอวันสอบ"
    };
  }

  if (!input.hasEvidence) {
    return {
      title: "ยังไม่มีหลักฐานของรอบนี้",
      description: "เริ่มจากบันทึกลิงก์เอกสารและสรุปหลักฐานให้ครบ ก่อนเสนอวันสอบ",
      actionLabel: "1. บันทึกหลักฐานก่อน",
      href: `#${studentScheduleEvidenceAnchor(input.kind)}`
    };
  }

  return {
    title: input.scheduleStatus === "REJECTED" ? "พร้อมเสนอวันสอบใหม่" : "มีหลักฐานครบแล้ว",
    description: input.scheduleStatus === "REJECTED"
      ? "กรรมการมีผู้ไม่สะดวก กรุณาตรวจหลักฐานเดิมแล้วเสนอวัน เวลา และห้องสอบใหม่"
      : "ตรวจหลักฐานที่บันทึกไว้ แล้วเสนอวัน เวลา และห้องสอบให้กรรมการพิจารณา",
    actionLabel: input.scheduleStatus === "REJECTED" ? "2. เสนอวันสอบใหม่" : "2. เสนอวันสอบ",
    href: "#schedule-proposal-form"
  };
}
