import type { Prisma, PrismaClient, SourceType } from "@prisma/client";
import { isRoundOpen } from "@/lib/assessments/courseRounds";
import { hasOpenLateRoundException, requiresLateRoundPenalty } from "@/lib/assessments/roundExceptions";
import { buildAdvisorRequestEmailTemplate } from "@/lib/notifications/templates";
import { canEditUntilDeadline } from "@/lib/submissions/versioning";
import { StudentActionConflictError } from "@/lib/projects/studentActionResult";

type MutationDb = Pick<PrismaClient, "$transaction">;

export type StudentMutationContext = {
  userId: string;
  studentId: string;
  projectId: string;
  studentCode: string;
  studentFirstNameTh: string;
  studentLastNameTh: string;
};

export type StudentMutationHooks = {
  fault?: (point: string) => void | Promise<void>;
  now?: () => Date;
};

export type StudentProfileInput = { preferredName: string | null; phone: string | null; lineId: string | null };

export type ProjectOriginInput = {
  initialProjectTitleTh: string;
  initialProjectTitleEn: string | null;
  sourceType: SourceType;
  reasonForTopic: string;
  expectedMathArea: string;
  tentativeAdvisorId: string;
  consultationSummary: string;
  initialReferences: string;
  materialLink: string;
  declarationAccepted: true;
};

export type ProposalTimelineItem = { activity: string; startWeek: number; endWeek: number; deliverable: string };

export type ProposalSubmissionInput = {
  titleTh: string;
  titleEn: string | null;
  abstractText: string;
  content: {
    motivationBackground: string;
    objectives: string;
    proposedMethods: string;
    expectedOutcomes: string;
    timeline: string;
    timelineItems: ProposalTimelineItem[];
    questionsForTeachers: string;
  };
  materialLink: string;
  declarationAccepted: true;
};

export type StudentMutationOutcome = {
  unchanged: boolean;
  advisorExternalNotification?: { projectId: string; advisorTeacherId: string };
};

async function lockProject(tx: Prisma.TransactionClient, projectId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "projects" WHERE "id" = ${projectId} FOR UPDATE
  `;
  if (!rows.length) throw new StudentActionConflictError("PROJECT_NOT_FOUND", "ไม่พบโครงงานล่าสุด กรุณารีเฟรชหน้าแล้วลองใหม่");
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

function sameProfile(committed: StudentProfileInput | null, input: StudentProfileInput) {
  return Boolean(committed
    && committed.preferredName === input.preferredName
    && committed.phone === input.phone
    && committed.lineId === input.lineId);
}

function originSnapshot(input: ProjectOriginInput) {
  return { ...input, status: "SUBMITTED" as const };
}

function sameOrigin(committed: Record<string, unknown> | null, input: ProjectOriginInput) {
  if (!committed) return false;
  return Object.entries(originSnapshot(input)).every(([key, value]) => committed[key] === value);
}

function proposalSnapshot(input: ProposalSubmissionInput) {
  return {
    titleTh: input.titleTh,
    titleEn: input.titleEn,
    abstractText: input.abstractText,
    contentJson: input.content,
    materialLink: input.materialLink,
    declarationAccepted: true,
    status: "SUBMITTED" as const
  };
}

function sameProposal(committed: {
  titleTh: string;
  titleEn: string | null;
  abstractText: string;
  contentJson: Prisma.JsonValue;
  materialLink: string;
  declarationAccepted: boolean;
  status: string;
} | null, input: ProposalSubmissionInput) {
  if (!committed) return false;
  const snapshot = proposalSnapshot(input);
  return committed.titleTh === snapshot.titleTh
    && committed.titleEn === snapshot.titleEn
    && committed.abstractText === snapshot.abstractText
    && stableJson(committed.contentJson) === stableJson(snapshot.contentJson)
    && committed.materialLink === snapshot.materialLink
    && committed.declarationAccepted === snapshot.declarationAccepted
    && committed.status === snapshot.status;
}

function projectLabel(context: StudentMutationContext, title: string | null) {
  return `${context.studentCode} ${context.studentFirstNameTh} ${context.studentLastNameTh}${title ? ` - ${title}` : ""}`;
}

export async function saveStudentProfileAtomic(
  db: MutationDb,
  context: StudentMutationContext,
  input: StudentProfileInput,
  hooks: StudentMutationHooks = {}
): Promise<StudentMutationOutcome> {
  const now = hooks.now?.() ?? new Date();
  return db.$transaction(async (tx) => {
    await lockProject(tx, context.projectId);
    const [project, committed] = await Promise.all([
      tx.project.findUniqueOrThrow({ where: { id: context.projectId } }),
      tx.studentProfile.findUnique({ where: { studentId: context.studentId } })
    ]);
    if (sameProfile(committed, input) && project.status !== "STUDENT_PROFILE") return { unchanged: true };

    const profile = await tx.studentProfile.upsert({
      where: { studentId: context.studentId },
      update: { ...input, completedAt: now },
      create: { studentId: context.studentId, ...input, completedAt: now }
    });
    await hooks.fault?.("profile_saved");
    if (project.status === "STUDENT_PROFILE") {
      await tx.project.update({ where: { id: project.id }, data: { status: "DRAFT" } });
      await tx.projectStatusHistory.create({
        data: { projectId: project.id, fromStatus: project.status, toStatus: "DRAFT", reason: "STUDENT_PROFILE_COMPLETED", actorUserId: context.userId }
      });
      await tx.projectTimelineEvent.create({
        data: {
          projectId: project.id,
          eventType: "STUDENT_PROFILE_COMPLETED",
          eventTitle: "บันทึกข้อมูลนักศึกษา",
          actorUserId: context.userId,
          relatedEntityType: "StudentProfile",
          relatedEntityId: profile.id
        }
      });
    }
    await hooks.fault?.("profile_evidence_saved");
    return { unchanged: false };
  });
}

export async function saveProjectOriginAtomic(
  db: MutationDb,
  context: StudentMutationContext,
  input: ProjectOriginInput,
  hooks: StudentMutationHooks = {}
): Promise<StudentMutationOutcome> {
  const now = hooks.now?.() ?? new Date();
  return db.$transaction(async (tx) => {
    await lockProject(tx, context.projectId);
    const project = await tx.project.findUniqueOrThrow({ where: { id: context.projectId } });
    const committed = await tx.projectOrigin.findUnique({ where: { projectId: project.id } });
    if (project.status !== "DRAFT") {
      if (sameOrigin(committed as unknown as Record<string, unknown> | null, input)) return { unchanged: true };
      throw new StudentActionConflictError("PROJECT_NOT_EDITABLE", "ขั้นตอนโครงงานเปลี่ยนไปแล้ว กรุณารีเฟรชหน้าและตรวจสอบสถานะล่าสุด");
    }

    const before = committed ? {
      initialProjectTitleTh: committed.initialProjectTitleTh,
      initialProjectTitleEn: committed.initialProjectTitleEn,
      sourceType: committed.sourceType,
      reasonForTopic: committed.reasonForTopic,
      expectedMathArea: committed.expectedMathArea,
      tentativeAdvisorId: committed.tentativeAdvisorId,
      consultationSummary: committed.consultationSummary,
      initialReferences: committed.initialReferences,
      materialLink: committed.materialLink,
      declarationAccepted: committed.declarationAccepted,
      status: committed.status
    } : null;
    const submitted = { ...originSnapshot(input), submittedAt: now };
    const origin = await tx.projectOrigin.upsert({
      where: { projectId: project.id },
      update: submitted,
      create: { ...submitted, projectId: project.id }
    });
    const latestVersion = await tx.projectOriginVersion.findFirst({
      where: { projectOriginId: origin.id }, orderBy: { versionNo: "desc" }, select: { versionNo: true }
    });
    await tx.projectOriginVersion.create({
      data: { projectOriginId: origin.id, versionNo: (latestVersion?.versionNo ?? 0) + 1, snapshotJson: originSnapshot(input), savedByUserId: context.userId }
    });
    await hooks.fault?.("origin_version_saved");

    const reminderDueAt = new Date(now);
    reminderDueAt.setDate(reminderDueAt.getDate() + 7);
    const existingRequest = await tx.advisorRequest.findFirst({
      where: { projectId: project.id, advisorTeacherId: input.tentativeAdvisorId, status: "PENDING" }
    });
    if (existingRequest) {
      await tx.advisorRequest.update({
        where: { id: existingRequest.id }, data: { requestedAt: now, reminderDueAt, studentMessage: input.consultationSummary }
      });
    } else {
      await tx.advisorRequest.create({
        data: {
          projectId: project.id,
          studentId: context.studentId,
          advisorTeacherId: input.tentativeAdvisorId,
          status: "PENDING",
          studentMessage: input.consultationSummary,
          requestedAt: now,
          reminderDueAt
        }
      });
    }
    await tx.project.update({
      where: { id: project.id },
      data: { status: "PENDING_ADVISOR", currentTitleTh: input.initialProjectTitleTh, currentTitleEn: input.initialProjectTitleEn }
    });
    await tx.projectStatusHistory.create({
      data: {
        projectId: project.id,
        fromStatus: project.status,
        toStatus: "PENDING_ADVISOR",
        reason: "STUDENT_SELECTED_ADVISOR",
        actorUserId: context.userId,
        metadataJson: { advisorReminderDays: 7 }
      }
    });
    await tx.projectTimelineEvent.create({
      data: {
        projectId: project.id,
        eventType: "PROJECT_ORIGIN_SUBMITTED",
        eventTitle: "ส่งข้อมูลเสนอหัวข้อ",
        actorUserId: context.userId,
        relatedEntityType: "ProjectOrigin",
        relatedEntityId: origin.id
      }
    });
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        action: "PROJECT_ORIGIN_SUBMITTED",
        entityType: "ProjectOrigin",
        entityId: origin.id,
        beforeJson: before ?? undefined,
        afterJson: originSnapshot(input)
      }
    });
    const advisor = await tx.teacher.findUniqueOrThrow({
      where: { id: input.tentativeAdvisorId },
      select: { id: true, userId: true, academicPrefix: true, firstNameTh: true, lastNameTh: true }
    });
    const advisorName = `${advisor.academicPrefix}${advisor.firstNameTh} ${advisor.lastNameTh}`;
    const notification = buildAdvisorRequestEmailTemplate({ projectLabel: projectLabel(context, input.initialProjectTitleTh), advisorName });
    await tx.notification.create({
      data: {
        projectId: project.id,
        userId: advisor.userId,
        teacherId: advisor.id,
        kind: "ADVISOR_REQUEST_SUBMITTED",
        title: notification.title,
        body: notification.body,
        emailReady: true
      }
    });
    await hooks.fault?.("origin_evidence_saved");
    return { unchanged: false, advisorExternalNotification: { projectId: project.id, advisorTeacherId: advisor.id } };
  });
}

export async function saveProposalSubmissionAtomic(
  db: MutationDb,
  context: StudentMutationContext,
  input: ProposalSubmissionInput,
  hooks: StudentMutationHooks = {}
): Promise<StudentMutationOutcome> {
  const now = hooks.now?.() ?? new Date();
  return db.$transaction(async (tx) => {
    await lockProject(tx, context.projectId);
    const project = await tx.project.findUniqueOrThrow({ where: { id: context.projectId } });
    const round = await tx.assessmentRound.findUnique({
      where: { courseOfferingId_roundType: { courseOfferingId: project.courseOfferingId, roundType: "PROPOSAL" } }
    });
    const existingAttempt = round ? await tx.assessmentAttempt.findUnique({
      where: { projectId_assessmentRoundId_attemptNo: { projectId: project.id, assessmentRoundId: round.id, attemptNo: 1 } },
      include: { presentationSubmission: true }
    }) : null;
    const committed = existingAttempt?.presentationSubmission ?? null;
    if (project.status !== "PROPOSAL_PENDING") {
      if (sameProposal(committed, input)) return { unchanged: true };
      throw new StudentActionConflictError("PROPOSAL_NOT_AVAILABLE", "สถานะ Proposal เปลี่ยนไปแล้ว กรุณารีเฟรชหน้าและตรวจสอบสถานะล่าสุด");
    }
    const origin = await tx.projectOrigin.findUnique({ where: { projectId: project.id } });
    if (!origin || origin.status !== "SUBMITTED") {
      throw new StudentActionConflictError("PROPOSAL_ORIGIN_MISSING", "ยังไม่พบข้อมูลเสนอหัวข้อที่ส่งเรียบร้อย กรุณาตรวจสอบขั้นตอนก่อนหน้า");
    }
    if (!round) throw new StudentActionConflictError("PROPOSAL_ROUND_NOT_OPEN", "ยังไม่เปิดรอบ Proposal กรุณารอประกาศจากผู้ดูแลระบบ");
    const lateRoundExceptions = await tx.projectRoundException.findMany({
      where: { projectId: project.id, assessmentRoundId: round.id, status: "OPEN" }, select: { exceptionType: true, status: true }
    });
    const hasLateOverride = hasOpenLateRoundException(lateRoundExceptions);
    if (!isRoundOpen(round.status) && !hasLateOverride) {
      throw new StudentActionConflictError("PROPOSAL_ROUND_CLOSED", "รอบ Proposal ปิดแล้ว กรุณาติดต่อผู้ดูแลระบบหากจำเป็นต้องส่งย้อนหลัง");
    }
    if (!hasLateOverride && !canEditUntilDeadline(now, round.submissionDeadline)) {
      throw new StudentActionConflictError("PROPOSAL_DEADLINE_PASSED", "พ้นกำหนดส่ง Proposal แล้ว กรุณาติดต่อผู้ดูแลระบบ");
    }

    const attempt = await tx.assessmentAttempt.upsert({
      where: { projectId_assessmentRoundId_attemptNo: { projectId: project.id, assessmentRoundId: round.id, attemptNo: 1 } },
      update: { status: "SCORING_OPEN" },
      create: { projectId: project.id, assessmentRoundId: round.id, attemptNo: 1, attemptType: "MAIN_PROPOSAL", status: "SCORING_OPEN" }
    });
    const before = committed ? {
      titleTh: committed.titleTh,
      titleEn: committed.titleEn,
      abstractText: committed.abstractText,
      contentJson: committed.contentJson,
      materialLink: committed.materialLink,
      declarationAccepted: committed.declarationAccepted,
      status: committed.status
    } : null;
    const submissionData = { ...proposalSnapshot(input), projectId: project.id, studentId: context.studentId, submittedAt: now };
    const submission = await tx.presentationSubmission.upsert({
      where: { assessmentAttemptId: attempt.id },
      update: submissionData,
      create: { ...submissionData, assessmentAttemptId: attempt.id }
    });
    const latestVersion = await tx.presentationSubmissionVersion.findFirst({
      where: { presentationSubmissionId: submission.id }, orderBy: { versionNo: "desc" }, select: { versionNo: true }
    });
    await tx.presentationSubmissionVersion.create({
      data: {
        presentationSubmissionId: submission.id,
        versionNo: (latestVersion?.versionNo ?? 0) + 1,
        snapshotJson: proposalSnapshot(input),
        savedByUserId: context.userId
      }
    });
    await hooks.fault?.("proposal_version_saved");

    const proposalTeachers = await tx.teacher.findMany({
      where: { active: true, isInternal: true, canEvaluateProposal: true, userId: { not: null } }
    });
    for (const teacher of proposalTeachers) {
      await tx.evaluatorAssignment.upsert({
        where: { assessmentAttemptId_evaluatorUserId: { assessmentAttemptId: attempt.id, evaluatorUserId: teacher.userId! } },
        update: { teacherId: teacher.id, evaluatorDisplayNameSnapshot: `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`, isRequired: true },
        create: {
          assessmentAttemptId: attempt.id,
          evaluatorUserId: teacher.userId!,
          teacherId: teacher.id,
          evaluatorDisplayNameSnapshot: `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`,
          status: "ASSIGNED",
          isRequired: true
        }
      });
    }
    await tx.project.update({ where: { id: project.id }, data: { status: "PROPOSAL_REVIEW", currentTitleTh: input.titleTh, currentTitleEn: input.titleEn } });
    await tx.projectStatusHistory.create({
      data: {
        projectId: project.id,
        fromStatus: project.status,
        toStatus: "PROPOSAL_REVIEW",
        reason: "STUDENT_ATTACHED_PROPOSAL_ABSTRACT_AND_LINK",
        actorUserId: context.userId
      }
    });
    await tx.projectTimelineEvent.create({
      data: {
        projectId: project.id,
        eventType: "PROPOSAL_SUBMITTED",
        eventTitle: "ส่ง Proposal",
        actorUserId: context.userId,
        relatedEntityType: "PresentationSubmission",
        relatedEntityId: submission.id,
        metadataJson: {
          lateRoundOverride: hasLateOverride,
          latePenaltyRequired: requiresLateRoundPenalty(lateRoundExceptions),
          latePenaltyPercent: requiresLateRoundPenalty(lateRoundExceptions) ? 10 : 0
        }
      }
    });
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        action: "PROPOSAL_SUBMITTED",
        entityType: "PresentationSubmission",
        entityId: submission.id,
        beforeJson: before ?? undefined,
        afterJson: proposalSnapshot(input)
      }
    });
    if (proposalTeachers.length) {
      const title = "มีเอกสาร Proposal ที่นักศึกษาส่งแล้ว";
      const body = [projectLabel(context, input.titleTh), "ใช้เป็นการแจ้งเตือนในระบบเท่านั้น ระบบจะไม่ส่งอีเมลหรือ LINE สำหรับการส่ง Proposal ตามรอบปกติ"].join("\n");
      await tx.notification.createMany({
        data: proposalTeachers.map((teacher) => ({
          projectId: project.id,
          userId: teacher.userId,
          teacherId: teacher.id,
          kind: "PROPOSAL_SUBMITTED",
          title,
          body,
          emailReady: false
        }))
      });
    }
    await hooks.fault?.("proposal_evidence_saved");
    return { unchanged: false };
  });
}
