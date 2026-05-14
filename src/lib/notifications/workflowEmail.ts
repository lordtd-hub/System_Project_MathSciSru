import type { AssessmentRoundType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatThaiScheduleRange } from "@/lib/format/dateTime";
import { buildAppUrl, sendEmailNotification, type EmailNotificationPayload } from "@/lib/notifications/email";
import {
  buildAdvisorRequestEmailTemplate,
  buildExamScheduleProposedEmailTemplate,
  buildProposalSubmittedEmailTemplate
} from "@/lib/notifications/templates";

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

  const baseTemplate = buildAdvisorRequestEmailTemplate({ projectLabel: projectLabel(project) });
  await prisma.notification.create({
    data: {
      projectId,
      userId: advisor.userId,
      teacherId: advisor.id,
      kind: "ADVISOR_REQUEST_SUBMITTED",
      title: baseTemplate.title,
      body: baseTemplate.body,
      emailReady: true
    }
  });

  const to = teacherEmail(advisor);
  const actionUrl = buildAppUrl("/teacher/advisor-requests");
  if (!to || !actionUrl) return;
  await sendManyBestEffort([{
    to,
    actionUrl,
    ...buildAdvisorRequestEmailTemplate({
      projectLabel: projectLabel(project),
      recipientName: teacherDisplayName(advisor)
    })
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

  const baseTemplate = buildProposalSubmittedEmailTemplate({ projectLabel: projectLabel(project) });
  await prisma.notification.createMany({
    data: teachers.map((teacher) => ({
      projectId,
      userId: teacher.userId,
      teacherId: teacher.id,
      kind: "PROPOSAL_SUBMITTED",
      title: baseTemplate.title,
      body: baseTemplate.body,
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
      actionUrl,
      ...buildProposalSubmittedEmailTemplate({
        projectLabel: projectLabel(project),
        recipientName: teacherDisplayName(teacher)
      })
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

  const scheduleRange = formatThaiScheduleRange(input.start, input.end);
  const baseTemplate = buildExamScheduleProposedEmailTemplate({
    projectLabel: projectLabel(project),
    roundType: input.roundType,
    scheduleRange,
    room: input.room
  });
  await prisma.notification.createMany({
    data: teachers.map((teacher) => ({
      projectId: input.projectId,
      userId: teacher.userId,
      teacherId: teacher.id,
      kind: "EXAM_SCHEDULE_PROPOSED",
      title: baseTemplate.title,
      body: baseTemplate.body,
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
      actionUrl,
      ...buildExamScheduleProposedEmailTemplate({
        projectLabel: projectLabel(project),
        recipientName: teacherDisplayName(teacher),
        roundType: input.roundType,
        scheduleRange,
        room: input.room
      })
    }];
  }));
}
