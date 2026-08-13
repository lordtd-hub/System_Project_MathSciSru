import type {
  AssessmentRoundType,
  AssessmentSubmissionKind,
  Prisma,
  PrismaClient
} from "@prisma/client";
import { isRoundOpen } from "@/lib/assessments/courseRounds";
import { isPresentationAssessmentComplete } from "@/lib/assessments/presentationCompletion";
import { getProgress1Readiness } from "@/lib/assessments/roundEligibility";
import { hasOpenLateRoundException, requiresLateRoundPenalty } from "@/lib/assessments/roundExceptions";
import { formatThaiScheduleRange } from "@/lib/format/dateTime";
import {
  buildAppUrl,
  sendEmailNotification,
  type EmailNotificationPayload
} from "@/lib/notifications/email";
import { sendLineNotification, type LineNotificationPayload } from "@/lib/notifications/line";
import { buildExamScheduleProposedEmailTemplate } from "@/lib/notifications/templates";
import { canStudentSubmitFinalReport } from "@/lib/reports/reportWorkflow";
import type { SchedulableRoundType } from "@/lib/scheduling/scheduleRules";
import { validateMaterialLink } from "@/lib/validators/materialLink";
import { StudentActionConflictError } from "./studentActionResult";

type MutationDb = Pick<PrismaClient, "$transaction">;

export type FutureStageMutationContext = {
  userId: string;
  studentId: string;
  projectId: string;
  studentCode: string;
  studentFirstNameTh: string;
  studentLastNameTh: string;
};

export type FutureStageMutationHooks = {
  fault?: (point: string) => void | Promise<void>;
  now?: () => Date;
};

export type AssessmentEvidenceInput = {
  kind: AssessmentSubmissionKind;
  roundType: SchedulableRoundType;
  title: string | null;
  materialLink: string;
  contentJson: Record<string, string>;
  summary: string;
};

export type ExamScheduleInput = {
  roundType: SchedulableRoundType;
  assessmentKind: AssessmentSubmissionKind;
  start: Date;
  end: Date | null;
  room: string | null;
  note: string | null;
};

export type ReportVersionInput = {
  driveLink: string;
  note: string;
};

export type ExamScheduleExternalNotification = {
  projectLabel: string;
  roundType: AssessmentRoundType | string;
  start: Date;
  end: Date | null;
  room: string | null;
  recipients: Array<{ displayName: string; email: string | null }>;
};

type ExternalDeliveryDependencies = {
  buildActionUrl: () => string | undefined;
  sendLine: (payload: LineNotificationPayload) => Promise<unknown>;
  sendEmail: (payload: EmailNotificationPayload) => Promise<unknown>;
};

const defaultExternalDeliveryDependencies: ExternalDeliveryDependencies = {
  buildActionUrl: () => buildAppUrl("/teacher/schedules"),
  sendLine: sendLineNotification,
  sendEmail: sendEmailNotification
};

async function lockProject(tx: Prisma.TransactionClient, projectId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "projects" WHERE "id" = ${projectId} FOR UPDATE
  `;
  if (!rows.length) {
    throw new StudentActionConflictError(
      "PROJECT_NOT_FOUND",
      "ไม่พบโครงงานล่าสุด กรุณารีเฟรชหน้าแล้วลองใหม่"
    );
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeReportNote(value: string) {
  return value.replace(/\r\n?/g, "\n").trim();
}

function normalizeReportLink(value: string) {
  const validated = validateMaterialLink(value);
  if (!validated.ok) return value.trim();
  const url = new URL(validated.normalizedUrl);
  url.hash = "";
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function sameEvidence(
  committed: {
    studentId: string;
    kind: AssessmentSubmissionKind;
    title: string | null;
    materialLink: string;
    contentJson: Prisma.JsonValue | null;
  } | null,
  context: FutureStageMutationContext,
  input: AssessmentEvidenceInput
) {
  return Boolean(
    committed
    && committed.studentId === context.studentId
    && committed.kind === input.kind
    && committed.title === input.title
    && committed.materialLink === input.materialLink
    && stableJson(committed.contentJson) === stableJson(input.contentJson)
  );
}

function sameSchedule(
  committed: {
    roundType: AssessmentRoundType | null;
    assessmentKind: AssessmentSubmissionKind;
    proposedStartAt: Date;
    proposedEndAt: Date | null;
    room: string | null;
    note: string | null;
    status: string;
    proposedByStudentId: string;
  } | null,
  context: FutureStageMutationContext,
  input: ExamScheduleInput
) {
  return Boolean(
    committed
    && (committed.status === "PROPOSED" || committed.status === "CONFIRMED")
    && committed.roundType === input.roundType
    && committed.assessmentKind === input.assessmentKind
    && committed.proposedStartAt.getTime() === input.start.getTime()
    && (committed.proposedEndAt?.getTime() ?? null) === (input.end?.getTime() ?? null)
    && committed.room === input.room
    && committed.note === input.note
    && committed.proposedByStudentId === context.studentId
  );
}

function projectLabel(
  context: FutureStageMutationContext,
  title: string | null
) {
  return `${context.studentCode} ${context.studentFirstNameTh} ${context.studentLastNameTh}${title ? ` - ${title}` : ""}`;
}

function teacherDisplayName(teacher: {
  academicPrefix: string;
  firstNameTh: string;
  lastNameTh: string;
}) {
  return `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`;
}

async function presentationComplete(
  tx: Prisma.TransactionClient,
  projectId: string,
  attemptType: "PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENTATION"
) {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: {
      committeeAssignments: { select: { teacherId: true, role: true, active: true } },
      attempts: {
        where: { attemptType },
        select: {
          evaluatorAssignments: {
            select: {
              teacherId: true,
              scoreSubmission: { select: { status: true } }
            }
          }
        }
      }
    }
  });
  if (!project) return false;
  return isPresentationAssessmentComplete({
    committeeAssignments: project.committeeAssignments,
    scoreSubmissions: project.attempts.flatMap((attempt) =>
      attempt.evaluatorAssignments.map((assignment) => ({
        teacherId: assignment.teacherId,
        status: assignment.scoreSubmission?.status ?? null
      }))
    )
  });
}

async function assertPreviousPresentationRoundComplete(
  tx: Prisma.TransactionClient,
  projectId: string,
  roundType: SchedulableRoundType
) {
  if (roundType === "PROGRESS_2" && !(await presentationComplete(tx, projectId, "PROGRESS_1"))) {
    throw new StudentActionConflictError(
      "SCHEDULE_PREVIOUS_ROUND_INCOMPLETE",
      "ยังประเมินรอบก่อนหน้าไม่ครบ กรุณารอผลการประเมินให้ครบก่อนดำเนินการรอบถัดไป"
    );
  }
  if (roundType === "FINAL_PRESENTATION") {
    const progress1Complete = await presentationComplete(tx, projectId, "PROGRESS_1");
    const progress2Complete = await presentationComplete(tx, projectId, "PROGRESS_2");
    if (!progress1Complete || !progress2Complete) {
      throw new StudentActionConflictError(
        "SCHEDULE_PREVIOUS_ROUND_INCOMPLETE",
        "ยังประเมินรอบก่อนหน้าไม่ครบ กรุณารอผลการประเมินให้ครบก่อนดำเนินการรอบถัดไป"
      );
    }
  }
}

async function assertProgress1Ready(
  tx: Prisma.TransactionClient,
  project: { id: string; status: Parameters<typeof getProgress1Readiness>[0]["status"] },
  assessmentRoundId: string
) {
  const [proposalResult, committeeAssignments, roundExceptions, latestProposalAttempt] = await Promise.all([
    tx.projectProposalResult.findFirst({
      where: { projectId: project.id },
      orderBy: { decidedAt: "desc" },
      select: { finalDecision: true }
    }),
    tx.committeeAssignment.findMany({
      where: { projectId: project.id },
      select: { role: true, active: true, teacherId: true }
    }),
    tx.projectRoundException.findMany({
      where: { projectId: project.id, assessmentRoundId, status: { not: "RESOLVED" } },
      select: { status: true, reason: true, exceptionType: true }
    }),
    tx.assessmentAttempt.findFirst({
      where: { projectId: project.id, assessmentRound: { roundType: "PROPOSAL" } },
      orderBy: { attemptNo: "desc" },
      select: {
        attemptNo: true,
        status: true,
        assessmentRound: { select: { roundType: true } },
        presentationSubmission: { select: { status: true } },
        evaluatorAssignments: { select: { teacherId: true, scoreSubmission: { select: { status: true } } } }
      }
    })
  ]);
  const readiness = getProgress1Readiness({
    id: project.id,
    status: project.status,
    proposalResults: proposalResult ? [proposalResult] : [],
    committeeAssignments,
    roundExceptions,
    attempts: latestProposalAttempt ? [latestProposalAttempt] : []
  });
  if (!readiness.eligible) {
    throw new StudentActionConflictError(
      "PROGRESS_1_PROJECT_NOT_READY",
      "โครงงานยังไม่พร้อมสำหรับรอบความก้าวหน้าครั้งที่ 1 กรุณาตรวจสอบผล Proposal และการแต่งตั้งกรรมการ"
    );
  }
}

async function readRoundState(
  tx: Prisma.TransactionClient,
  project: { id: string; courseOfferingId: string },
  roundType: SchedulableRoundType
) {
  const round = await tx.assessmentRound.findUnique({
    where: {
      courseOfferingId_roundType: {
        courseOfferingId: project.courseOfferingId,
        roundType
      }
    }
  });
  if (!round) {
    throw new StudentActionConflictError(
      "SCHEDULE_ROUND_NOT_OPEN",
      "ยังไม่เปิดรอบสอบนี้ กรุณารอประกาศจากผู้ดูแลระบบ"
    );
  }
  const lateRoundExceptions = await tx.projectRoundException.findMany({
    where: { projectId: project.id, assessmentRoundId: round.id, status: "OPEN" },
    select: { exceptionType: true, status: true }
  });
  const hasLateOverride = hasOpenLateRoundException(lateRoundExceptions);
  if (!isRoundOpen(round.status) && !hasLateOverride) {
    throw new StudentActionConflictError(
      "SCHEDULE_ROUND_NOT_OPEN",
      "รอบสอบนี้ยังไม่เปิดหรือปิดแล้ว กรุณาตรวจสอบสถานะล่าสุด"
    );
  }
  return { round, lateRoundExceptions, hasLateOverride };
}

export async function saveAssessmentEvidenceAtomic(
  db: MutationDb,
  context: FutureStageMutationContext,
  input: AssessmentEvidenceInput,
  hooks: FutureStageMutationHooks = {}
) {
  const now = hooks.now?.() ?? new Date();
  return db.$transaction(async (tx) => {
    await lockProject(tx, context.projectId);
    const project = await tx.project.findUnique({ where: { id: context.projectId } });
    if (!project) {
      throw new StudentActionConflictError("PROJECT_NOT_FOUND", "ไม่พบโครงงานล่าสุด กรุณารีเฟรชหน้าแล้วลองใหม่");
    }
    const committed = await tx.assessmentSubmission.findFirst({
      where: { projectId: project.id, kind: input.kind },
      orderBy: { submittedAt: "desc" }
    });
    if (sameEvidence(committed, context, input)) {
      return { unchanged: true, submissionId: committed!.id };
    }
    if (project.status !== "IN_PROGRESS") {
      throw new StudentActionConflictError(
        "ASSESSMENT_EVIDENCE_NOT_AVAILABLE",
        "ขั้นตอนโครงงานเปลี่ยนไปแล้ว กรุณารีเฟรชหน้าและตรวจสอบสถานะล่าสุด"
      );
    }

    const { round, lateRoundExceptions, hasLateOverride } = await readRoundState(tx, project, input.roundType);
    await assertPreviousPresentationRoundComplete(tx, project.id, input.roundType);
    if (input.roundType === "PROGRESS_1") await assertProgress1Ready(tx, project, round.id);

    const lockedSchedule = await tx.examScheduleProposal.findFirst({
      where: {
        projectId: project.id,
        assessmentRoundId: round.id,
        status: { in: ["PROPOSED", "CONFIRMED"] }
      },
      select: { id: true }
    });
    if (lockedSchedule) {
      throw new StudentActionConflictError(
        "ASSESSMENT_EVIDENCE_LOCKED",
        "ส่งข้อเสนอวันสอบแล้ว จึงแก้ไขเอกสารรอบนี้ไม่ได้ กรุณาตรวจสอบสถานะล่าสุด"
      );
    }

    const data = {
      studentId: context.studentId,
      kind: input.kind,
      title: input.title,
      materialLink: input.materialLink,
      contentJson: input.contentJson,
      submittedAt: now
    };
    const submission = committed
      ? await tx.assessmentSubmission.update({ where: { id: committed.id }, data })
      : await tx.assessmentSubmission.create({ data: { ...data, projectId: project.id } });
    await hooks.fault?.("assessment_submission_saved");
    const latePenaltyRequired = requiresLateRoundPenalty(lateRoundExceptions);
    await tx.projectTimelineEvent.create({
      data: {
        projectId: project.id,
        eventType: "ASSESSMENT_EVIDENCE_SAVED",
        eventTitle: `บันทึกเอกสาร ${input.roundType}`,
        eventDescription: input.summary,
        actorUserId: context.userId,
        relatedEntityType: "AssessmentSubmission",
        relatedEntityId: submission.id,
        metadataJson: {
          kind: input.kind,
          roundType: input.roundType,
          materialLink: input.materialLink,
          lateRoundOverride: hasLateOverride,
          latePenaltyRequired,
          latePenaltyPercent: latePenaltyRequired ? 10 : 0
        }
      }
    });
    await hooks.fault?.("assessment_evidence_saved");
    return { unchanged: false, submissionId: submission.id };
  });
}

export async function submitExamScheduleAtomic(
  db: MutationDb,
  context: FutureStageMutationContext,
  input: ExamScheduleInput,
  hooks: FutureStageMutationHooks = {}
) {
  return db.$transaction(async (tx) => {
    await lockProject(tx, context.projectId);
    const project = await tx.project.findUnique({ where: { id: context.projectId } });
    if (!project) {
      throw new StudentActionConflictError("PROJECT_NOT_FOUND", "ไม่พบโครงงานล่าสุด กรุณารีเฟรชหน้าแล้วลองใหม่");
    }
    const round = await tx.assessmentRound.findUnique({
      where: {
        courseOfferingId_roundType: {
          courseOfferingId: project.courseOfferingId,
          roundType: input.roundType
        }
      }
    });
    if (!round) {
      throw new StudentActionConflictError("SCHEDULE_ROUND_NOT_OPEN", "ยังไม่เปิดรอบสอบนี้ กรุณารอประกาศจากผู้ดูแลระบบ");
    }
    const existing = await tx.examScheduleProposal.findUnique({
      where: {
        projectId_assessmentRoundId: {
          projectId: project.id,
          assessmentRoundId: round.id
        }
      }
    });
    if (sameSchedule(existing, context, input)) {
      return { unchanged: true, scheduleId: existing!.id, externalNotification: undefined };
    }
    if (project.status !== "IN_PROGRESS") {
      throw new StudentActionConflictError(
        "SCHEDULE_NOT_AVAILABLE",
        "ขั้นตอนโครงงานเปลี่ยนไปแล้ว กรุณารีเฟรชหน้าและตรวจสอบสถานะล่าสุด"
      );
    }

    const lateRoundExceptions = await tx.projectRoundException.findMany({
      where: { projectId: project.id, assessmentRoundId: round.id, status: "OPEN" },
      select: { exceptionType: true, status: true }
    });
    const hasLateOverride = hasOpenLateRoundException(lateRoundExceptions);
    if (!isRoundOpen(round.status) && !hasLateOverride) {
      throw new StudentActionConflictError("SCHEDULE_ROUND_NOT_OPEN", "รอบสอบนี้ยังไม่เปิดหรือปิดแล้ว กรุณาตรวจสอบสถานะล่าสุด");
    }
    await assertPreviousPresentationRoundComplete(tx, project.id, input.roundType);
    const evidence = await tx.assessmentSubmission.findFirst({
      where: { projectId: project.id, kind: input.assessmentKind },
      orderBy: { submittedAt: "desc" },
      select: { id: true }
    });
    if (!evidence) {
      throw new StudentActionConflictError(
        "ASSESSMENT_EVIDENCE_REQUIRED",
        "กรุณาบันทึกเอกสารหรือหลักฐานของรอบสอบนี้ก่อนเสนอวันสอบ"
      );
    }
    if (input.roundType === "PROGRESS_1") await assertProgress1Ready(tx, project, round.id);
    if (existing?.status === "PROPOSED" || existing?.status === "CONFIRMED") {
      throw new StudentActionConflictError(
        "SCHEDULE_REQUEST_LOCKED",
        "ข้อเสนอวันสอบถูกส่งแล้ว กรุณารอกรรมการพิจารณาหรือตรวจสอบสถานะล่าสุด"
      );
    }

    const scheduleData = {
      courseOfferingId: project.courseOfferingId,
      assessmentRoundId: round.id,
      roundType: input.roundType,
      assessmentKind: input.assessmentKind,
      proposedStartAt: input.start,
      proposedEndAt: input.end,
      room: input.room,
      note: input.note,
      status: "PROPOSED" as const,
      proposedByStudentId: context.studentId
    };
    const schedule = await tx.examScheduleProposal.upsert({
      where: {
        projectId_assessmentRoundId: {
          projectId: project.id,
          assessmentRoundId: round.id
        }
      },
      update: scheduleData,
      create: { ...scheduleData, projectId: project.id }
    });
    await hooks.fault?.("schedule_saved");

    const [committee, advisors] = await Promise.all([
      tx.committeeAssignment.findMany({
        where: { projectId: project.id, active: true, role: { in: ["ADVISOR", "HEAD", "MEMBER"] } },
        select: { teacherId: true }
      }),
      tx.advisorRequest.findMany({
        where: { projectId: project.id, status: "APPROVED" },
        select: { advisorTeacherId: true }
      })
    ]);
    const requiredApproverIds = [
      ...new Set([
        ...committee.map((assignment) => assignment.teacherId),
        ...advisors.map((request) => request.advisorTeacherId)
      ])
    ];
    for (const teacherId of requiredApproverIds) {
      await tx.examScheduleApproval.upsert({
        where: { scheduleProposalId_teacherId: { scheduleProposalId: schedule.id, teacherId } },
        update: { decision: "PENDING", comment: null, decidedAt: null },
        create: { scheduleProposalId: schedule.id, teacherId }
      });
    }

    const teachers = requiredApproverIds.length
      ? await tx.teacher.findMany({
          where: { id: { in: requiredApproverIds } },
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
      : [];
    const scheduleRange = formatThaiScheduleRange(input.start, input.end);
    const notificationTemplate = buildExamScheduleProposedEmailTemplate({
      projectLabel: projectLabel(context, project.currentTitleTh),
      roundType: input.roundType,
      scheduleRange,
      room: input.room
    });
    if (teachers.length) {
      await tx.notification.createMany({
        data: teachers.map((teacher) => ({
          projectId: project.id,
          userId: teacher.userId,
          teacherId: teacher.id,
          kind: "EXAM_SCHEDULE_PROPOSED",
          title: notificationTemplate.title,
          body: notificationTemplate.body,
          emailReady: true
        }))
      });
    }

    const latePenaltyRequired = requiresLateRoundPenalty(lateRoundExceptions);
    await tx.projectTimelineEvent.create({
      data: {
        projectId: project.id,
        eventType: "EXAM_SCHEDULE_PROPOSED",
        eventTitle: `เสนอวันสอบ ${input.roundType}`,
        eventDescription: input.note,
        actorUserId: context.userId,
        relatedEntityType: "ExamScheduleProposal",
        relatedEntityId: schedule.id,
        metadataJson: {
          roundType: input.roundType,
          assessmentSubmissionId: evidence.id,
          proposedStartAt: input.start.toISOString(),
          room: input.room,
          lateRoundOverride: hasLateOverride,
          latePenaltyRequired,
          latePenaltyPercent: latePenaltyRequired ? 10 : 0
        }
      }
    });
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        action: "EXAM_SCHEDULE_PROPOSED",
        entityType: "ExamScheduleProposal",
        entityId: schedule.id,
        beforeJson: existing ? {
          roundType: existing.roundType,
          assessmentKind: existing.assessmentKind,
          proposedStartAt: existing.proposedStartAt.toISOString(),
          proposedEndAt: existing.proposedEndAt?.toISOString() ?? null,
          room: existing.room,
          status: existing.status
        } : undefined,
        afterJson: {
          roundType: scheduleData.roundType,
          assessmentKind: scheduleData.assessmentKind,
          proposedStartAt: input.start.toISOString(),
          proposedEndAt: input.end?.toISOString() ?? null,
          room: scheduleData.room,
          status: scheduleData.status
        },
        metadataJson: { requiredApproverIds }
      }
    });
    await hooks.fault?.("schedule_evidence_saved");

    return {
      unchanged: false,
      scheduleId: schedule.id,
      externalNotification: {
        projectLabel: projectLabel(context, project.currentTitleTh),
        roundType: input.roundType,
        start: input.start,
        end: input.end,
        room: input.room,
        recipients: teachers.map((teacher) => ({
          displayName: teacherDisplayName(teacher),
          email: teacher.email?.trim() || teacher.user?.email?.trim() || null
        }))
      } satisfies ExamScheduleExternalNotification
    };
  });
}

export async function submitReportVersionAtomic(
  db: MutationDb,
  context: FutureStageMutationContext,
  rawInput: ReportVersionInput,
  hooks: FutureStageMutationHooks = {}
) {
  const input = {
    driveLink: normalizeReportLink(rawInput.driveLink),
    note: normalizeReportNote(rawInput.note)
  };
  return db.$transaction(async (tx) => {
    await lockProject(tx, context.projectId);
    const project = await tx.project.findUnique({ where: { id: context.projectId } });
    if (!project) {
      throw new StudentActionConflictError("PROJECT_NOT_FOUND", "ไม่พบโครงงานล่าสุด กรุณารีเฟรชหน้าแล้วลองใหม่");
    }
    const latestReport = await tx.reportVersion.findFirst({
      where: { projectId: project.id },
      include: { reviews: true },
      orderBy: { versionNo: "desc" }
    });
    const latestNoteEvent = latestReport
      ? await tx.projectTimelineEvent.findFirst({
          where: {
            projectId: project.id,
            eventType: "REPORT_VERSION_SUBMITTED",
            relatedEntityType: "ReportVersion",
            relatedEntityId: latestReport.id
          },
          orderBy: { occurredAt: "desc" },
          select: { eventDescription: true }
        })
      : null;
    if (
      latestReport
      && latestReport.reviews.length === 0
      && normalizeReportLink(latestReport.driveLink) === input.driveLink
      && normalizeReportNote(latestNoteEvent?.eventDescription ?? "") === input.note
    ) {
      return {
        unchanged: true,
        reportVersionId: latestReport.id,
        versionNo: latestReport.versionNo
      };
    }

    const finalPresentationCompleted = project.status === "IN_PROGRESS"
      ? await presentationComplete(tx, project.id, "FINAL_PRESENTATION")
      : false;
    const latestReportHasRevisionRequest = Boolean(
      latestReport?.reviews.some((review) => review.decision === "FAIL")
    );
    if (!canStudentSubmitFinalReport({
      projectStatus: project.status,
      latestReportHasRevisionRequest,
      finalPresentationCompleted
    })) {
      throw new StudentActionConflictError(
        "REPORT_NOT_AVAILABLE",
        "ยังส่งรายงานในขั้นตอนนี้ไม่ได้ กรุณารีเฟรชหน้าและตรวจสอบสถานะหรือผลการตรวจล่าสุด"
      );
    }

    const versionNo = (latestReport?.versionNo ?? 0) + 1;
    const reportVersion = await tx.reportVersion.create({
      data: {
        projectId: project.id,
        versionNo,
        driveLink: input.driveLink,
        submittedByStudentId: context.studentId
      }
    });
    await hooks.fault?.("report_version_saved");
    const shouldMoveToReview = project.status === "FINAL_DONE" || finalPresentationCompleted;
    if (shouldMoveToReview) {
      await tx.project.update({
        where: { id: project.id },
        data: { status: "REPORT_REVIEW" }
      });
      await tx.projectStatusHistory.create({
        data: {
          projectId: project.id,
          fromStatus: project.status,
          toStatus: "REPORT_REVIEW",
          reason: "REPORT_VERSION_SUBMITTED",
          actorUserId: context.userId,
          metadataJson: { reportVersionId: reportVersion.id, versionNo }
        }
      });
    }
    await tx.projectTimelineEvent.create({
      data: {
        projectId: project.id,
        eventType: "REPORT_VERSION_SUBMITTED",
        eventTitle: `ส่งเล่มรายงานฉบับที่ ${versionNo}`,
        eventDescription: input.note || null,
        actorUserId: context.userId,
        relatedEntityType: "ReportVersion",
        relatedEntityId: reportVersion.id,
        metadataJson: { versionNo, driveLink: input.driveLink }
      }
    });
    await hooks.fault?.("report_evidence_saved");
    return { unchanged: false, reportVersionId: reportVersion.id, versionNo };
  });
}

export async function deliverExamScheduleExternalNotification(
  notification: ExamScheduleExternalNotification,
  dependencies: ExternalDeliveryDependencies = defaultExternalDeliveryDependencies
) {
  if (!notification.recipients.length) return;
  const actionUrl = dependencies.buildActionUrl();
  if (!actionUrl) return;
  const scheduleRange = formatThaiScheduleRange(notification.start, notification.end);
  const baseTemplate = buildExamScheduleProposedEmailTemplate({
    projectLabel: notification.projectLabel,
    roundType: notification.roundType,
    scheduleRange,
    room: notification.room
  });
  const emailPayloads = notification.recipients.flatMap((recipient) =>
    recipient.email
      ? [{
          to: recipient.email,
          actionUrl,
          ...buildExamScheduleProposedEmailTemplate({
            projectLabel: notification.projectLabel,
            recipientName: recipient.displayName,
            roundType: notification.roundType,
            scheduleRange,
            room: notification.room
          })
        }]
      : []
  );
  await Promise.allSettled([
    dependencies.sendLine({ ...baseTemplate, actionUrl }),
    ...emailPayloads.map((payload) => dependencies.sendEmail(payload))
  ]);
}
