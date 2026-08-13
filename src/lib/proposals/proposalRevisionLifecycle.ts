import type { Decision, Prisma, PrismaClient, ProjectStatus, SubmissionStatus } from "@prisma/client";
import { summarizeProposalScores } from "@/lib/scoring/proposalSummary";
import {
  ProposalLifecycleConflictError,
  ProposalLifecycleValidationError
} from "./proposalLifecycleActionResult";

type ProposalLifecycleDb = Pick<PrismaClient, "$transaction">;

export type ProposalLifecycleHooks = {
  fault?: (point: string) => void | Promise<void>;
  now?: () => Date;
};

type ProposalLifecycleActorInput = {
  actorUserId: string;
  requestId: string;
};

export type AdminProposalFinalDecisionInput = ProposalLifecycleActorInput & {
  assessmentAttemptId: string;
  finalDecision: Decision;
  finalDecisionReason: string | null;
};

export type ProposalRevisionInput = ProposalLifecycleActorInput & {
  projectId: string;
  titleTh: string;
  titleEn: string | null;
  abstractText: string;
  contentJson: Prisma.InputJsonValue;
  materialLink: string;
  declarationAccepted: true;
};

export type AdvisorProposalRevisionReviewInput = ProposalLifecycleActorInput & {
  projectId: string;
  decision: "CERTIFY" | "RETURN";
  reason: string | null;
};

export type AdminProposalRevisionUnlockInput = ProposalLifecycleActorInput & {
  projectId: string;
  reason: string;
};

type ProposalLifecycleOutcome = {
  unchanged: boolean;
  projectId: string;
  submissionId: string;
};

const transactionOptions = {
  isolationLevel: "Serializable" as const,
  maxWait: 5_000,
  timeout: 15_000
};

async function lockProject(tx: Prisma.TransactionClient, projectId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "projects" WHERE "id" = ${projectId} FOR UPDATE
  `;
  if (!rows.length) {
    throw new ProposalLifecycleConflictError(
      "PROJECT_NOT_FOUND",
      "ไม่พบโครงงานล่าสุด กรุณารีเฟรชหน้าแล้วลองใหม่"
    );
  }
}

async function requireActiveActor(
  tx: Prisma.TransactionClient,
  actorUserId: string,
  roles: Array<"ADMIN" | "STUDENT" | "TEACHER">
) {
  const actor = await tx.user.findUnique({
    where: { id: actorUserId },
    select: { id: true, globalRole: true, active: true }
  });
  if (!actor || !actor.active || !roles.some((role) => role === actor.globalRole)) {
    throw new ProposalLifecycleConflictError(
      "ACTOR_NOT_AUTHORIZED",
      "บัญชีนี้ไม่มีสิทธิ์ดำเนินการ กรุณารีเฟรชหน้าและเข้าสู่ระบบใหม่"
    );
  }
  return actor;
}

function normalizedReason(reason: string | null | undefined) {
  return reason?.trim() || null;
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

function sameRevisionSubmission(
  submission: {
    titleTh: string;
    titleEn: string | null;
    abstractText: string;
    contentJson: Prisma.JsonValue;
    materialLink: string;
    declarationAccepted: boolean;
    status: SubmissionStatus;
  },
  input: ProposalRevisionInput
) {
  return submission.titleTh === input.titleTh
    && submission.titleEn === input.titleEn
    && submission.abstractText === input.abstractText
    && stableJson(submission.contentJson) === stableJson(input.contentJson)
    && submission.materialLink === input.materialLink
    && submission.declarationAccepted === input.declarationAccepted
    && submission.status === "SUBMITTED";
}

async function latestProposalRevisionContext(tx: Prisma.TransactionClient, projectId: string) {
  return tx.projectProposalResult.findFirst({
    where: { projectId },
    orderBy: { decidedAt: "desc" },
    include: {
      assessmentAttempt: {
        include: { presentationSubmission: true }
      }
    }
  });
}

async function latestApprovedAdvisor(tx: Prisma.TransactionClient, projectId: string) {
  return tx.advisorRequest.findFirst({
    where: { projectId },
    orderBy: [
      { requestedAt: "desc" },
      { reviewedAt: { sort: "desc", nulls: "last" } }
    ],
    include: {
      advisorTeacher: {
        select: { id: true, userId: true, active: true }
      }
    }
  });
}

function adminDecisionTarget(decision: Decision): {
  projectStatus: ProjectStatus;
  submissionStatus: SubmissionStatus | null;
  reason: string;
} {
  if (decision === "PASS") {
    return {
      projectStatus: "TOPIC_APPROVED",
      submissionStatus: "LOCKED",
      reason: "PROPOSAL_FINAL_PASS"
    };
  }
  if (decision === "PASS_WITH_REVISION") {
    return {
      projectStatus: "PROPOSAL_REVISION_REQUIRED",
      submissionStatus: "RETURNED_FOR_REVISION",
      reason: "PROPOSAL_FINAL_REVISION_REQUIRED"
    };
  }
  return {
    projectStatus: "DRAFT",
    submissionStatus: null,
    reason: "PROPOSAL_FINAL_NOT_PASS_PR1"
  };
}

function isCommittedAdminDecisionState(
  decision: Decision,
  projectStatus: ProjectStatus,
  submissionStatus: SubmissionStatus
) {
  if (decision === "PASS") {
    return projectStatus === "TOPIC_APPROVED" && submissionStatus === "LOCKED";
  }
  if (decision === "NOT_PASS") {
    return projectStatus === "DRAFT";
  }
  return (
    (projectStatus === "PROPOSAL_REVISION_REQUIRED"
      && ["RETURNED_FOR_REVISION", "SUBMITTED"].includes(submissionStatus))
    || (projectStatus === "TOPIC_APPROVED" && submissionStatus === "LOCKED")
  );
}

export async function saveAdminProposalFinalDecisionAtomic(
  db: ProposalLifecycleDb,
  input: AdminProposalFinalDecisionInput,
  hooks: ProposalLifecycleHooks = {}
): Promise<ProposalLifecycleOutcome & { proposalResultId: string }> {
  const reason = normalizedReason(input.finalDecisionReason);
  if (!(["PASS", "PASS_WITH_REVISION", "NOT_PASS"] as string[]).includes(input.finalDecision)) {
    throw new ProposalLifecycleValidationError(
      "PROPOSAL_FINAL_DECISION_INVALID",
      "กรุณาเลือกมติการเสนอหัวข้อให้ถูกต้อง",
      ["final_decision"]
    );
  }
  if (input.finalDecision !== "PASS" && !reason) {
    throw new ProposalLifecycleValidationError(
      "PROPOSAL_FINAL_DECISION_REASON_REQUIRED",
      "กรุณาระบุเหตุผลหรือมติสำหรับผลที่ต้องแก้ไขหรือไม่ผ่าน",
      ["final_decision_reason"]
    );
  }

  const now = hooks.now?.() ?? new Date();
  return db.$transaction(async (tx) => {
    await requireActiveActor(tx, input.actorUserId, ["ADMIN"]);
    const attemptContext = await tx.assessmentAttempt.findUnique({
      where: { id: input.assessmentAttemptId },
      select: { projectId: true }
    });
    if (!attemptContext) {
      throw new ProposalLifecycleConflictError(
        "PROPOSAL_ATTEMPT_NOT_FOUND",
        "ไม่พบรอบประเมิน Proposal นี้ กรุณารีเฟรชหน้าแล้วลองใหม่"
      );
    }
    await lockProject(tx, attemptContext.projectId);

    const attempt = await tx.assessmentAttempt.findUnique({
      where: { id: input.assessmentAttemptId },
      include: {
        project: { include: { student: { select: { id: true, userId: true } } } },
        presentationSubmission: true,
        proposalResult: true,
        evaluatorAssignments: {
          include: {
            scoreSubmission: { include: { proposalDecision: true } }
          }
        }
      }
    });
    if (!attempt || !["MAIN_PROPOSAL", "REPROPOSAL"].includes(attempt.attemptType) || !attempt.presentationSubmission) {
      throw new ProposalLifecycleConflictError(
        "PROPOSAL_ATTEMPT_NOT_READY",
        "ข้อมูล Proposal ยังไม่พร้อมให้บันทึกมติ กรุณารีเฟรชหน้าและตรวจสอบสถานะล่าสุด"
      );
    }
    if (attempt.attemptType === "REPROPOSAL") {
      const latestAttempt = await tx.assessmentAttempt.findFirst({
        where: { projectId: attempt.projectId, assessmentRoundId: attempt.assessmentRoundId },
        orderBy: { attemptNo: "desc" },
        select: { id: true }
      });
      if (latestAttempt?.id !== attempt.id) {
        throw new ProposalLifecycleConflictError(
          "REPROPOSAL_ATTEMPT_NOT_LATEST",
          "รอบสอบหัวข้อนี้ไม่ใช่รอบล่าสุด กรุณารีเฟรชหน้าและเลือกผลของรอบล่าสุด"
        );
      }
    }

    const summary = summarizeProposalScores(
      attempt.evaluatorAssignments.length,
      attempt.evaluatorAssignments.flatMap((assignment) => assignment.scoreSubmission
        ? [{
            totalScore: Number(assignment.scoreSubmission.totalScore),
            status: assignment.scoreSubmission.status,
            decision: assignment.scoreSubmission.proposalDecision?.decision ?? null
          }]
        : [])
    );
    const existingResult = attempt.proposalResult;
    let isDecisionEdit = false;
    if (existingResult) {
      const sameDecision = existingResult.finalDecision === input.finalDecision
        && normalizedReason(existingResult.finalDecisionReason) === reason;
      if (sameDecision) {
        if (!isCommittedAdminDecisionState(
          input.finalDecision,
          attempt.project.status,
          attempt.presentationSubmission.status
        )) {
          throw new ProposalLifecycleConflictError(
            "PROPOSAL_FINAL_DECISION_STATE_INCOMPLETE",
            "พบมติเดิมแต่สถานะหลักฐานไม่สอดคล้อง กรุณาแจ้งผู้ดูแลระบบโดยไม่บันทึกซ้ำ"
          );
        }
        return {
          unchanged: true,
          projectId: attempt.projectId,
          submissionId: attempt.presentationSubmission.id,
          proposalResultId: existingResult.id
        };
      }

      if (existingResult.finalDecision === "NOT_PASS" || attempt.project.status === "DRAFT") {
        throw new ProposalLifecycleConflictError(
          "PROPOSAL_NOT_PASS_DECISION_IMMUTABLE",
          "ไม่สามารถแก้ไขมติไม่ผ่านจากสถานะ DRAFT เดิมได้ กรุณาดำเนินการตามขั้นตอน Proposal รอบใหม่"
        );
      }
      if (existingResult.finalDecision === "PASS_WITH_REVISION") {
        if (attempt.project.status === "TOPIC_APPROVED" && attempt.presentationSubmission.status === "LOCKED") {
          throw new ProposalLifecycleConflictError(
            "PROPOSAL_FINAL_DECISION_UNLOCK_REQUIRED",
            "อาจารย์ที่ปรึกษารับรองฉบับแก้ไขแล้ว กรุณาปลดล็อกพร้อมเหตุผลก่อนเปลี่ยนมติ"
          );
        }
        if (
          attempt.project.status !== "PROPOSAL_REVISION_REQUIRED"
          || !(["RETURNED_FOR_REVISION", "SUBMITTED"] as SubmissionStatus[]).includes(attempt.presentationSubmission.status)
        ) {
          throw new ProposalLifecycleConflictError(
            "PROPOSAL_FINAL_DECISION_EDIT_STALE_STATE",
            "สถานะ Proposal เดิมไม่อนุญาตให้แก้ไขมติ กรุณารีเฟรชหน้าและตรวจสอบประวัติ"
          );
        }
      } else if (existingResult.finalDecision === "PASS") {
        if (attempt.project.status !== "TOPIC_APPROVED" || attempt.presentationSubmission.status !== "LOCKED") {
          throw new ProposalLifecycleConflictError(
            "PROPOSAL_FINAL_DECISION_EDIT_STALE_STATE",
            "สถานะ Proposal ที่ผ่านแล้วไม่สอดคล้องกับหลักฐาน กรุณารีเฟรชหน้าและตรวจสอบประวัติ"
          );
        }
        const activeCommitteeCount = await tx.committeeAssignment.count({
          where: { projectId: attempt.projectId, active: true }
        });
        if (activeCommitteeCount > 0) {
          throw new ProposalLifecycleConflictError(
            "ACTIVE_COMMITTEE_EXISTS",
            "ไม่สามารถแก้ไขมติ Proposal หลังแต่งตั้งกรรมการที่ยังใช้งานอยู่"
          );
        }
      }
      isDecisionEdit = true;
    } else if (
      attempt.presentationSubmission.status !== "SUBMITTED"
      || !(["PROPOSAL_REVIEW", "PROPOSAL_ADMIN_DECISION"] as ProjectStatus[]).includes(attempt.project.status)
    ) {
      throw new ProposalLifecycleConflictError(
        "PROPOSAL_FINAL_DECISION_STALE_STATE",
        "สถานะ Proposal เปลี่ยนไปแล้ว กรุณารีเฟรชหน้าและตรวจสอบก่อนบันทึกมติ"
      );
    }

    const target = adminDecisionTarget(input.finalDecision);
    const resultData = {
      averageScore: summary.averageScore,
      submittedCount: summary.submittedCount,
      missingCount: summary.missingCount,
      passCount: summary.passCount,
      revisionCount: summary.revisionCount,
      notPassCount: summary.notPassCount,
      finalDecision: input.finalDecision,
      finalDecisionReason: reason,
      decidedByAdminId: input.actorUserId,
      decidedAt: now
    };
    const proposalResult = existingResult
      ? await tx.projectProposalResult.update({
          where: { assessmentAttemptId: attempt.id },
          data: resultData
        })
      : await tx.projectProposalResult.create({
          data: {
            assessmentAttemptId: attempt.id,
            projectId: attempt.projectId,
            ...resultData
          }
        });
    await hooks.fault?.("admin_decision_result_saved");

    await tx.project.update({
      where: { id: attempt.projectId },
      data: { status: target.projectStatus }
    });
    if (target.submissionStatus) {
      await tx.presentationSubmission.update({
        where: { id: attempt.presentationSubmission.id },
        data: {
          status: target.submissionStatus,
          lockedAt: target.submissionStatus === "LOCKED" ? now : null
        }
      });
    }
    let cancelledAdvisorRequestCount = 0;
    if (input.finalDecision === "NOT_PASS") {
      const cancelled = await tx.advisorRequest.updateMany({
        where: { projectId: attempt.projectId, status: { in: ["PENDING", "APPROVED"] } },
        data: { status: "CANCELLED", reviewedAt: now }
      });
      cancelledAdvisorRequestCount = cancelled.count;
    }
    if (attempt.attemptType === "REPROPOSAL") {
      await tx.assessmentAttempt.update({
        where: { id: attempt.id },
        data: { status: "SCORING_CLOSED", closedAt: now }
      });
    }
    await hooks.fault?.("admin_decision_state_saved");

    await tx.projectStatusHistory.create({
      data: {
        projectId: attempt.projectId,
        fromStatus: attempt.project.status,
        toStatus: target.projectStatus,
        reason: isDecisionEdit ? "PROPOSAL_FINAL_DECISION_EDITED" : target.reason,
        actorUserId: input.actorUserId,
        metadataJson: {
          requestId: input.requestId,
          assessmentAttemptId: attempt.id,
          proposalResultId: proposalResult.id,
          finalDecision: input.finalDecision,
          attemptType: attempt.attemptType,
          cancelledAdvisorRequestCount
        }
      }
    });
    await tx.projectTimelineEvent.create({
      data: {
        projectId: attempt.projectId,
        eventType: isDecisionEdit ? "ADMIN_FINAL_PROPOSAL_DECISION_EDITED" : "ADMIN_FINAL_PROPOSAL_DECISION",
        eventTitle: isDecisionEdit
          ? "ผู้ดูแลระบบแก้ไขมติการเสนอหัวข้อ"
          : "ผู้ดูแลระบบบันทึกมติการเสนอหัวข้อ",
        eventDescription: reason,
        actorUserId: input.actorUserId,
        relatedEntityType: "ProjectProposalResult",
        relatedEntityId: proposalResult.id,
        metadataJson: { finalDecision: input.finalDecision, requestId: input.requestId }
      }
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: isDecisionEdit ? "PROPOSAL_FINAL_DECISION_EDITED" : "PROPOSAL_FINAL_DECISION_SAVED",
        entityType: "ProjectProposalResult",
        entityId: proposalResult.id,
        beforeJson: {
          projectStatus: attempt.project.status,
          submissionStatus: attempt.presentationSubmission.status,
          finalDecision: existingResult?.finalDecision ?? null,
          finalDecisionReason: existingResult?.finalDecisionReason ?? null
        },
        afterJson: {
          projectStatus: target.projectStatus,
          submissionStatus: target.submissionStatus ?? attempt.presentationSubmission.status,
          attemptStatus: attempt.attemptType === "REPROPOSAL" ? "SCORING_CLOSED" : attempt.status,
          finalDecision: input.finalDecision,
          averageScore: summary.averageScore,
          submittedCount: summary.submittedCount,
          missingCount: summary.missingCount
        },
        metadataJson: {
          requestId: input.requestId,
          assessmentAttemptId: attempt.id,
          attemptType: attempt.attemptType,
          cancelledAdvisorRequestCount
        }
      }
    });
    await tx.notification.create({
      data: {
        projectId: attempt.projectId,
        userId: attempt.project.student.userId,
        kind: isDecisionEdit ? "PROPOSAL_FINAL_DECISION_EDITED" : "PROPOSAL_FINAL_DECISION_RECORDED",
        title: input.finalDecision === "PASS"
          ? "หัวข้อโครงงานผ่านการพิจารณาแล้ว"
          : input.finalDecision === "PASS_WITH_REVISION"
            ? "กรุณาแก้ไข Proposal ตามมติ"
            : "บันทึกผลการเสนอหัวข้อแล้ว",
        body: reason,
        emailReady: false
      }
    });
    await hooks.fault?.("admin_decision_evidence_saved");

    return {
      unchanged: false,
      projectId: attempt.projectId,
      submissionId: attempt.presentationSubmission.id,
      proposalResultId: proposalResult.id
    };
  }, transactionOptions);
}

export async function submitProposalRevisionAtomic(
  db: ProposalLifecycleDb,
  input: ProposalRevisionInput,
  hooks: ProposalLifecycleHooks = {}
): Promise<ProposalLifecycleOutcome & { versionNo: number }> {
  const now = hooks.now?.() ?? new Date();
  return db.$transaction(async (tx) => {
    await requireActiveActor(tx, input.actorUserId, ["STUDENT"]);
    await lockProject(tx, input.projectId);
    const project = await tx.project.findUnique({
      where: { id: input.projectId },
      include: { student: { select: { id: true, userId: true } } }
    });
    if (!project || project.student.userId !== input.actorUserId) {
      throw new ProposalLifecycleConflictError(
        "STUDENT_PROJECT_NOT_AUTHORIZED",
        "บัญชีนักศึกษานี้ไม่ใช่เจ้าของโครงงาน กรุณารีเฟรชหน้าและเข้าสู่ระบบใหม่"
      );
    }
    const [context, advisor] = await Promise.all([
      latestProposalRevisionContext(tx, project.id),
      latestApprovedAdvisor(tx, project.id)
    ]);
    const result = context;
    const submission = context?.assessmentAttempt.presentationSubmission ?? null;
    if (!result || result.finalDecision !== "PASS_WITH_REVISION") {
      throw new ProposalLifecycleConflictError(
        "PROPOSAL_REVISION_DECISION_REQUIRED",
        "ยังไม่มีมติให้แก้ไข Proposal กรุณารีเฟรชหน้าและตรวจสอบผลล่าสุด"
      );
    }
    if (project.status !== "PROPOSAL_REVISION_REQUIRED" || !submission) {
      throw new ProposalLifecycleConflictError(
        "PROPOSAL_REVISION_NOT_AVAILABLE",
        "สถานะโครงงานยังไม่เปิดให้ส่ง Proposal ฉบับแก้ไข กรุณารีเฟรชหน้า"
      );
    }
    if (advisor?.status !== "APPROVED" || !advisor.advisorTeacher.active) {
      throw new ProposalLifecycleConflictError(
        "APPROVED_ADVISOR_NOT_FOUND",
        "ไม่พบอาจารย์ที่ปรึกษาที่อนุมัติล่าสุด กรุณาติดต่อผู้ดูแลระบบ"
      );
    }

    const latestVersion = await tx.presentationSubmissionVersion.findFirst({
      where: { presentationSubmissionId: submission.id },
      orderBy: { versionNo: "desc" },
      select: { versionNo: true }
    });
    if (sameRevisionSubmission(submission, input)) {
      return {
        unchanged: true,
        projectId: project.id,
        submissionId: submission.id,
        versionNo: latestVersion?.versionNo ?? 0
      };
    }
    if (submission.status !== "RETURNED_FOR_REVISION") {
      throw new ProposalLifecycleConflictError(
        "PROPOSAL_REVISION_STALE_SUBMISSION",
        "เอกสารฉบับล่าสุดไม่ได้อยู่ในสถานะให้แก้ไข กรุณารีเฟรชหน้าและตรวจสอบผลการส่ง"
      );
    }

    const versionNo = (latestVersion?.versionNo ?? 0) + 1;
    const updated = await tx.presentationSubmission.update({
      where: { id: submission.id },
      data: {
        titleTh: input.titleTh,
        titleEn: input.titleEn,
        abstractText: input.abstractText,
        contentJson: input.contentJson,
        materialLink: input.materialLink,
        declarationAccepted: input.declarationAccepted,
        status: "SUBMITTED",
        submittedAt: now,
        lockedAt: null
      }
    });
    await tx.project.update({
      where: { id: project.id },
      data: { currentTitleTh: input.titleTh, currentTitleEn: input.titleEn }
    });
    const version = await tx.presentationSubmissionVersion.create({
      data: {
        presentationSubmissionId: submission.id,
        versionNo,
        snapshotJson: {
          titleTh: input.titleTh,
          titleEn: input.titleEn,
          abstractText: input.abstractText,
          contentJson: input.contentJson,
          materialLink: input.materialLink,
          declarationAccepted: input.declarationAccepted,
          status: "SUBMITTED"
        },
        savedByUserId: input.actorUserId,
        savedAt: now
      }
    });
    await hooks.fault?.("student_revision_version_saved");

    await tx.projectStatusHistory.create({
      data: {
        projectId: project.id,
        fromStatus: project.status,
        toStatus: "PROPOSAL_REVISION_REQUIRED",
        reason: "STUDENT_PROPOSAL_REVISION_SUBMITTED",
        actorUserId: input.actorUserId,
        metadataJson: { requestId: input.requestId, submissionId: submission.id, versionNo }
      }
    });
    await tx.projectTimelineEvent.create({
      data: {
        projectId: project.id,
        eventType: "PROPOSAL_REVISION_SUBMITTED",
        eventTitle: `นักศึกษาส่ง Proposal ฉบับแก้ไขครั้งที่ ${versionNo}`,
        actorUserId: input.actorUserId,
        relatedEntityType: "PresentationSubmissionVersion",
        relatedEntityId: version.id,
        metadataJson: { requestId: input.requestId, versionNo }
      }
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "PROPOSAL_REVISION_SUBMITTED",
        entityType: "PresentationSubmission",
        entityId: submission.id,
        beforeJson: { status: submission.status },
        afterJson: { status: updated.status, versionNo },
        metadataJson: { requestId: input.requestId, projectId: project.id }
      }
    });
    await tx.notification.create({
      data: {
        projectId: project.id,
        userId: advisor.advisorTeacher.userId,
        teacherId: advisor.advisorTeacher.id,
        kind: "PROPOSAL_REVISION_SUBMITTED",
        title: "มี Proposal ฉบับแก้ไขรอการตรวจรับรอง",
        body: "กรุณาตรวจฉบับแก้ไขล่าสุดและเลือกส่งคืนหรือรับรอง",
        emailReady: false
      }
    });
    await hooks.fault?.("student_revision_evidence_saved");

    return { unchanged: false, projectId: project.id, submissionId: submission.id, versionNo };
  }, transactionOptions);
}

export async function reviewProposalRevisionByAdvisorAtomic(
  db: ProposalLifecycleDb,
  input: AdvisorProposalRevisionReviewInput,
  hooks: ProposalLifecycleHooks = {}
): Promise<ProposalLifecycleOutcome> {
  const reason = normalizedReason(input.reason);
  if (input.decision !== "CERTIFY" && input.decision !== "RETURN") {
    throw new ProposalLifecycleValidationError(
      "ADVISOR_REVISION_DECISION_INVALID",
      "กรุณาเลือกส่งคืนหรือรับรอง Proposal ฉบับแก้ไข",
      ["decision"]
    );
  }
  if (input.decision === "RETURN" && !reason) {
    throw new ProposalLifecycleValidationError(
      "ADVISOR_RETURN_REASON_REQUIRED",
      "กรุณาระบุเหตุผลที่ส่ง Proposal กลับไปแก้ไข",
      ["reason"]
    );
  }

  const now = hooks.now?.() ?? new Date();
  return db.$transaction(async (tx) => {
    await requireActiveActor(tx, input.actorUserId, ["TEACHER", "ADMIN"]);
    await lockProject(tx, input.projectId);
    const [teacher, project, context, advisor] = await Promise.all([
      tx.teacher.findUnique({
        where: { userId: input.actorUserId },
        select: { id: true, userId: true, active: true }
      }),
      tx.project.findUnique({
        where: { id: input.projectId },
        include: { student: { select: { id: true, userId: true } } }
      }),
      latestProposalRevisionContext(tx, input.projectId),
      latestApprovedAdvisor(tx, input.projectId)
    ]);
    const result = context;
    const submission = context?.assessmentAttempt.presentationSubmission ?? null;
    if (
      !teacher
      || !teacher.active
      || !advisor
      || advisor.status !== "APPROVED"
      || advisor.advisorTeacherId !== teacher.id
    ) {
      throw new ProposalLifecycleConflictError(
        "ADVISOR_NOT_AUTHORIZED",
        "เฉพาะอาจารย์ที่ปรึกษาที่ได้รับอนุมัติล่าสุดเท่านั้นที่ตรวจ Proposal ฉบับแก้ไขได้"
      );
    }
    if (!project || !submission || !result || result.finalDecision !== "PASS_WITH_REVISION") {
      throw new ProposalLifecycleConflictError(
        "PROPOSAL_REVISION_CONTEXT_MISSING",
        "ไม่พบข้อมูล Proposal ฉบับแก้ไขที่พร้อมตรวจ กรุณารีเฟรชหน้า"
      );
    }

    const targetProjectStatus: ProjectStatus = input.decision === "CERTIFY"
      ? "TOPIC_APPROVED"
      : "PROPOSAL_REVISION_REQUIRED";
    const targetSubmissionStatus: SubmissionStatus = input.decision === "CERTIFY"
      ? "LOCKED"
      : "RETURNED_FOR_REVISION";
    if (project.status === targetProjectStatus && submission.status === targetSubmissionStatus) {
      return { unchanged: true, projectId: project.id, submissionId: submission.id };
    }
    if (project.status !== "PROPOSAL_REVISION_REQUIRED" || submission.status !== "SUBMITTED") {
      throw new ProposalLifecycleConflictError(
        "PROPOSAL_REVISION_REVIEW_STALE_STATE",
        "สถานะ Proposal ฉบับแก้ไขเปลี่ยนไปแล้ว กรุณารีเฟรชหน้าก่อนตรวจอีกครั้ง"
      );
    }

    await tx.project.update({
      where: { id: project.id },
      data: { status: targetProjectStatus }
    });
    await tx.presentationSubmission.update({
      where: { id: submission.id },
      data: {
        status: targetSubmissionStatus,
        lockedAt: input.decision === "CERTIFY" ? now : null
      }
    });
    await hooks.fault?.("advisor_revision_state_saved");

    const eventType = input.decision === "CERTIFY"
      ? "PROPOSAL_REVISION_CERTIFIED"
      : "PROPOSAL_REVISION_RETURNED";
    await tx.projectStatusHistory.create({
      data: {
        projectId: project.id,
        fromStatus: project.status,
        toStatus: targetProjectStatus,
        reason: eventType,
        actorUserId: input.actorUserId,
        metadataJson: { requestId: input.requestId, submissionId: submission.id }
      }
    });
    await tx.projectTimelineEvent.create({
      data: {
        projectId: project.id,
        eventType,
        eventTitle: input.decision === "CERTIFY"
          ? "อาจารย์ที่ปรึกษารับรอง Proposal ฉบับแก้ไข"
          : "อาจารย์ที่ปรึกษาส่ง Proposal กลับไปแก้ไข",
        eventDescription: reason,
        actorUserId: input.actorUserId,
        relatedEntityType: "PresentationSubmission",
        relatedEntityId: submission.id,
        metadataJson: { requestId: input.requestId, advisorRequestId: advisor.id }
      }
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: eventType,
        entityType: "PresentationSubmission",
        entityId: submission.id,
        beforeJson: { projectStatus: project.status, submissionStatus: submission.status },
        afterJson: { projectStatus: targetProjectStatus, submissionStatus: targetSubmissionStatus },
        metadataJson: { requestId: input.requestId, advisorRequestId: advisor.id }
      }
    });
    await tx.notification.create({
      data: {
        projectId: project.id,
        userId: project.student.userId,
        kind: eventType,
        title: input.decision === "CERTIFY"
          ? "อาจารย์ที่ปรึกษารับรอง Proposal ฉบับแก้ไขแล้ว"
          : "อาจารย์ที่ปรึกษาส่ง Proposal กลับมาให้แก้ไข",
        body: reason,
        emailReady: false
      }
    });
    await hooks.fault?.("advisor_revision_evidence_saved");

    return { unchanged: false, projectId: project.id, submissionId: submission.id };
  }, transactionOptions);
}

export async function unlockProposalRevisionAtomic(
  db: ProposalLifecycleDb,
  input: AdminProposalRevisionUnlockInput,
  hooks: ProposalLifecycleHooks = {}
): Promise<ProposalLifecycleOutcome> {
  const reason = normalizedReason(input.reason);
  if (!reason) {
    throw new ProposalLifecycleValidationError(
      "ADMIN_UNLOCK_REASON_REQUIRED",
      "กรุณาระบุเหตุผลในการเปิด Proposal ฉบับแก้ไข",
      ["reason"]
    );
  }

  return db.$transaction(async (tx) => {
    await requireActiveActor(tx, input.actorUserId, ["ADMIN"]);
    await lockProject(tx, input.projectId);
    const [project, context] = await Promise.all([
      tx.project.findUnique({
        where: { id: input.projectId },
        include: { student: { select: { id: true, userId: true } } }
      }),
      latestProposalRevisionContext(tx, input.projectId)
    ]);
    const result = context;
    const submission = context?.assessmentAttempt.presentationSubmission ?? null;
    if (!project || !submission || !result || result.finalDecision !== "PASS_WITH_REVISION") {
      throw new ProposalLifecycleConflictError(
        "ADMIN_UNLOCK_CONTEXT_MISSING",
        "เปิดแก้ไขได้เฉพาะ Proposal ที่ผ่านโดยให้แก้ไขและได้รับการรับรองแล้ว"
      );
    }
    if (project.status === "PROPOSAL_REVISION_REQUIRED" && submission.status === "RETURNED_FOR_REVISION") {
      return { unchanged: true, projectId: project.id, submissionId: submission.id };
    }
    if (project.status !== "TOPIC_APPROVED" || submission.status !== "LOCKED") {
      throw new ProposalLifecycleConflictError(
        "ADMIN_UNLOCK_STALE_STATE",
        "สถานะ Proposal เปลี่ยนไปแล้ว กรุณารีเฟรชหน้าและตรวจสอบก่อนเปิดแก้ไข"
      );
    }
    const activeCommitteeCount = await tx.committeeAssignment.count({
      where: { projectId: project.id, active: true }
    });
    if (activeCommitteeCount > 0) {
      throw new ProposalLifecycleConflictError(
        "ACTIVE_COMMITTEE_EXISTS",
        "ไม่สามารถเปิด Proposal แก้ไขได้หลังแต่งตั้งกรรมการที่ยังใช้งานอยู่"
      );
    }

    await tx.project.update({
      where: { id: project.id },
      data: { status: "PROPOSAL_REVISION_REQUIRED" }
    });
    await tx.presentationSubmission.update({
      where: { id: submission.id },
      data: { status: "RETURNED_FOR_REVISION", lockedAt: null }
    });
    await hooks.fault?.("admin_unlock_state_saved");

    await tx.projectStatusHistory.create({
      data: {
        projectId: project.id,
        fromStatus: project.status,
        toStatus: "PROPOSAL_REVISION_REQUIRED",
        reason: "ADMIN_UNLOCKED_PROPOSAL_REVISION",
        actorUserId: input.actorUserId,
        metadataJson: { requestId: input.requestId, submissionId: submission.id }
      }
    });
    await tx.projectTimelineEvent.create({
      data: {
        projectId: project.id,
        eventType: "PROPOSAL_REVISION_UNLOCKED",
        eventTitle: "ผู้ดูแลระบบเปิด Proposal ให้แก้ไขอีกครั้ง",
        eventDescription: reason,
        actorUserId: input.actorUserId,
        relatedEntityType: "PresentationSubmission",
        relatedEntityId: submission.id,
        metadataJson: { requestId: input.requestId }
      }
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "PROPOSAL_REVISION_UNLOCKED",
        entityType: "PresentationSubmission",
        entityId: submission.id,
        beforeJson: { projectStatus: project.status, submissionStatus: submission.status },
        afterJson: {
          projectStatus: "PROPOSAL_REVISION_REQUIRED",
          submissionStatus: "RETURNED_FOR_REVISION"
        },
        metadataJson: { requestId: input.requestId, reason }
      }
    });
    await tx.notification.create({
      data: {
        projectId: project.id,
        userId: project.student.userId,
        kind: "PROPOSAL_REVISION_UNLOCKED",
        title: "ผู้ดูแลระบบเปิด Proposal ให้แก้ไขอีกครั้ง",
        body: reason,
        emailReady: false
      }
    });
    await hooks.fault?.("admin_unlock_evidence_saved");

    return { unchanged: false, projectId: project.id, submissionId: submission.id };
  }, transactionOptions);
}
