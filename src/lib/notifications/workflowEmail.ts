import type { AssessmentRoundType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatThaiScheduleRange } from "@/lib/format/dateTime";
import { buildAppUrl, sendEmailNotification, type EmailNotificationPayload } from "@/lib/notifications/email";

type TeacherRecipient = {
  id: string;
  userId: string | null;
  email: string | null;
  academicPrefix: string;
  firstNameTh: string;
  lastNameTh: string;
  user?: { email: string | null } | null;
};

function teacherDisplayName(teacher: Pick<TeacherRecipient, "academicPrefix" | "firstNameTh" | "lastNameTh">) {
  return `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`;
}

function teacherEmail(teacher: TeacherRecipient) {
  return teacher.email?.trim() || teacher.user?.email?.trim() || null;
}

function projectLabel(project: { currentTitleTh: string | null; student: { studentCode: string; firstNameTh: string; lastNameTh: string } }) {
  return `${project.student.studentCode} ${project.student.firstNameTh} ${project.student.lastNameTh}${project.currentTitleTh ? ` - ${project.currentTitleTh}` : ""}`;
}

function roundLabel(roundType: string) {
  if (roundType === "PROGRESS_1") return "สอบความก้าวหน้าครั้งที่ 1";
  if (roundType === "PROGRESS_2") return "สอบความก้าวหน้าครั้งที่ 2";
  if (roundType === "FINAL_PRESENTATION") return "สอบนำเสนอขั้นสุดท้าย";
  if (roundType === "PROPOSAL") return "Proposal";
  return roundType;
}

async function sendManyBestEffort(payloads: EmailNotificationPayload[]) {
  await Promise.allSettled(payloads.map((payload) => sendEmailNotification(payload)));
}

export async function notifyAdvisorRequestSubmitted(projectId: string, advisorTeacherId: string) {
  const [project, advisor] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        currentTitleTh: true,
        student: { select: { studentCode: true, firstNameTh: true, lastNameTh: true } }
      }
    }),
    prisma.teacher.findUnique({
      where: { id: advisorTeacherId },
      select: {
        id: true,
        userId: true,
        email: true,
        academicPrefix: true,
        firstNameTh: true,
        lastNameTh: true,
        user: { select: { email: true } }
      }
    })
  ]);
  if (!project || !advisor) return;

  const title = "มีนักศึกษาขอเลือกท่านเป็นอาจารย์ที่ปรึกษา";
  const body = `${projectLabel(project)}\nกรุณาเข้าสู่ระบบเพื่อพิจารณาคำขอเป็นอาจารย์ที่ปรึกษา`;
  await prisma.notification.create({
    data: {
      projectId,
      userId: advisor.userId,
      teacherId: advisor.id,
      kind: "ADVISOR_REQUEST_SUBMITTED",
      title,
      body,
      emailReady: true
    }
  });

  const to = teacherEmail(advisor);
  const actionUrl = buildAppUrl("/teacher/advisor-requests");
  if (!to || !actionUrl) return;
  await sendManyBestEffort([{
    to,
    subject: title,
    title,
    body: `${body}\n\nผู้รับ: ${teacherDisplayName(advisor)}`,
    actionUrl,
    actionLabel: "เปิดคำขอที่ปรึกษา",
    previewText: title
  }]);
}

export async function notifyProposalSubmitted(projectId: string, teacherIds: string[]) {
  const uniqueTeacherIds = [...new Set(teacherIds)].filter(Boolean);
  if (!uniqueTeacherIds.length) return;
  const [project, teachers] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        currentTitleTh: true,
        student: { select: { studentCode: true, firstNameTh: true, lastNameTh: true } }
      }
    }),
    prisma.teacher.findMany({
      where: { id: { in: uniqueTeacherIds } },
      select: {
        id: true,
        userId: true,
        email: true,
        academicPrefix: true,
        firstNameTh: true,
        lastNameTh: true,
        user: { select: { email: true } }
      }
    })
  ]);
  if (!project || !teachers.length) return;

  const title = "มีเอกสาร Proposal รอประเมิน";
  const body = `${projectLabel(project)}\nนักศึกษาส่งเอกสาร Proposal แล้ว กรุณาเข้าสู่ระบบเพื่อตรวจประเมิน`;
  await prisma.notification.createMany({
    data: teachers.map((teacher) => ({
      projectId,
      userId: teacher.userId,
      teacherId: teacher.id,
      kind: "PROPOSAL_SUBMITTED",
      title,
      body,
      emailReady: true
    }))
  });

  const actionUrl = buildAppUrl("/teacher/proposals");
  if (!actionUrl) return;
  await sendManyBestEffort(teachers.flatMap((teacher) => {
    const to = teacherEmail(teacher);
    if (!to) return [];
    return [{
      to,
      subject: title,
      title,
      body: `${body}\n\nผู้รับ: ${teacherDisplayName(teacher)}`,
      actionUrl,
      actionLabel: "เปิดงานประเมิน Proposal",
      previewText: title
    }];
  }));
}

export async function notifyExamScheduleProposed(input: {
  projectId: string;
  scheduleId: string;
  teacherIds: string[];
  roundType: AssessmentRoundType | string;
  start: Date;
  end: Date | null;
  room: string | null;
}) {
  const uniqueTeacherIds = [...new Set(input.teacherIds)].filter(Boolean);
  if (!uniqueTeacherIds.length) return;
  const [project, teachers] = await Promise.all([
    prisma.project.findUnique({
      where: { id: input.projectId },
      select: {
        id: true,
        currentTitleTh: true,
        student: { select: { studentCode: true, firstNameTh: true, lastNameTh: true } }
      }
    }),
    prisma.teacher.findMany({
      where: { id: { in: uniqueTeacherIds } },
      select: {
        id: true,
        userId: true,
        email: true,
        academicPrefix: true,
        firstNameTh: true,
        lastNameTh: true,
        user: { select: { email: true } }
      }
    })
  ]);
  if (!project || !teachers.length) return;

  const title = `มีคำขอนัดวันสอบ ${roundLabel(input.roundType)}`;
  const body = [
    projectLabel(project),
    `วันเวลา: ${formatThaiScheduleRange(input.start, input.end)}`,
    `ห้อง: ${input.room || "ยังไม่ระบุ"}`,
    "กรุณาเข้าสู่ระบบเพื่ออนุมัติหรือไม่อนุมัติวันสอบ"
  ].join("\n");
  await prisma.notification.createMany({
    data: teachers.map((teacher) => ({
      projectId: input.projectId,
      userId: teacher.userId,
      teacherId: teacher.id,
      kind: "EXAM_SCHEDULE_PROPOSED",
      title,
      body,
      emailReady: true
    }))
  });

  const actionUrl = buildAppUrl("/teacher/schedules");
  if (!actionUrl) return;
  await sendManyBestEffort(teachers.flatMap((teacher) => {
    const to = teacherEmail(teacher);
    if (!to) return [];
    return [{
      to,
      subject: title,
      title,
      body: `${body}\n\nผู้รับ: ${teacherDisplayName(teacher)}`,
      actionUrl,
      actionLabel: "เปิดตารางสอบ",
      previewText: title
    }];
  }));
}
