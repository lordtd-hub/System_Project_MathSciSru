"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { isRoundOpen } from "@/lib/assessments/courseRounds";
import { isPresentationAssessmentComplete } from "@/lib/assessments/presentationCompletion";
import { applyLatePenalty, hasOpenLateRoundException, requiresLateRoundPenalty } from "@/lib/assessments/roundExceptions";
import { prisma } from "@/lib/db";
import { createActionTimer } from "@/lib/diagnostics/actionTiming";
import { redirectWithQuery } from "@/lib/navigation/redirectWithQuery";
import { isCurrentAdvisorRequestReviewable } from "@/lib/projects/currentAdvisorRequest";
import { assertRateLimit, pilotRateLimits, RateLimitExceededError } from "@/lib/security/rateLimit";
import { requestSizeLimits, sizeError } from "@/lib/security/requestSize";
import { advisorApproveTransition, advisorRejectTransition } from "@/lib/lifecycle/transitions";
import { totalAdvisorScore, validateAdvisorScore, type AdvisorScoreInput } from "@/lib/scoring/advisorScoring";
import { validateProposalDecision } from "@/lib/scoring/checklistScoring";
import { isPresentationScoreEditable, isProposalScoreEditable } from "@/lib/scoring/scoreEditability";
import { missingScoreFieldNames } from "@/lib/scoring/formCompleteness";
import { PROPOSAL_DRAFT_V2_AUDIT_ACTION, readOptionalConditionCount } from "@/lib/scoring/proposalDraftIntegrity";
import type { TeacherScoreActionResult } from "@/lib/scoring/teacherScoreActionResult";
import type { ProposalStartActionResult } from "@/lib/scoring/proposalStartActionResult";
import { openProposalAssignment } from "@/lib/scoring/openProposalAssignment";
import { calculateCriterionScore, findProposalQaCriterion } from "@/lib/rubrics/proposalQaRubric";
import { readActiveAssessmentRubric, readProposalConditionRubric } from "@/lib/rubrics/readProposalConditionRubric";
import {
  ProposalLifecycleValidationError,
  runProposalLifecycleAction,
  type ProposalLifecycleActionResult
} from "@/lib/proposals/proposalLifecycleActionResult";
import { reviewProposalRevisionByAdvisorAtomic } from "@/lib/proposals/proposalRevisionLifecycle";
import { calculateFinalQaCriterionScore, findFinalQaCriterion } from "@/lib/rubrics/finalQaRubric";
import { calculateProgressQaCriterionScore, findProgressQaCriterion } from "@/lib/rubrics/progressQaRubric";
import {
  validateProgress1Score,
  validateProgress2Score,
  type Progress1ScoreInput,
  type Progress2ScoreInput
} from "@/lib/scoring/progress1Scoring";
import { validateMarkdownInput } from "@/lib/validators/submissionContent";
import {
  allRequiredReportReviewersPassed,
  isAssignedReportReviewer,
  latestReportVersionHasRevisionRequest,
  requiredReportReviewerIds
} from "@/lib/reports/reportWorkflow";

function uniqueIds(ids: string[]) {
  return [...new Set(ids)];
}

function redirectIfTeacherTextTooLong(value: string, maxBytes: number, label: string, path: string, error = "teacher_text_too_long") {
  if (sizeError(value, maxBytes, label)) {
    redirectWithQuery(path, { error });
  }
}

function redirectIfTeacherMarkdownInvalid(errors: string[], path: string) {
  if (errors.length) {
    redirectWithQuery(path, { error: "teacher_markdown_invalid" });
  }
}

function redirectIfTeacherFormInvalid(errors: string[], path: string, error = "teacher_score_invalid") {
  if (errors.length) {
    redirectWithQuery(path, { error });
  }
}

function redirectIfScoreFieldsIncomplete(formData: FormData, fieldNames: string[], path: string) {
  if (missingScoreFieldNames(formData, fieldNames).length > 0) {
    redirectWithQuery(path, { error: "score_rubric_incomplete" });
  }
}

function progressScoreFieldName(itemKey: string) {
  if (itemKey === "problemSolving") return "problem_solving";
  if (itemKey === "researchResults") return "research_results";
  return itemKey;
}

async function requireTeacherUser() {
  const session = await auth();
  if (!session?.user.id || (!hasApprovedTeacherCapability(session.user) && session.user.role !== "PENDING_TEACHER")) {
    throw new Error("ไม่อนุญาตให้เข้าถึง");
  }
  return session.user;
}

async function requirePendingTeacherClaimUser() {
  const session = await auth();
  if (!session?.user.id || session.user.role !== "PENDING_TEACHER") {
    throw new Error("ส่งคำขอผูกบัญชีอาจารย์ได้เฉพาะบัญชีที่ยังรอผู้ดูแลระบบอนุมัติ");
  }
  return session.user;
}

async function assertConfirmedSchedule(projectId: string, assessmentKind: "PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENT", label: string) {
  const confirmedSchedule = await prisma.examScheduleProposal.findFirst({
    where: { projectId, assessmentKind, status: "CONFIRMED" },
    select: { id: true }
  });
  if (!confirmedSchedule) {
    throw new Error(`${label} ต้องมีการยืนยันวันสอบจากกรรมการครบก่อนจึงจะบันทึกคะแนนได้`);
  }
}

async function assertPresentationScoreRoundEditable(
  projectId: string,
  assessmentRoundId: string,
  roundStatus: Parameters<typeof isPresentationScoreEditable>[0]["roundStatus"],
  redirectPath: string
) {
  const roundExceptions = await prisma.projectRoundException.findMany({
    where: { projectId, assessmentRoundId, status: "OPEN" },
    select: { exceptionType: true, status: true }
  });
  if (!isPresentationScoreEditable({ roundStatus, roundExceptions })) {
    redirectWithQuery(redirectPath, { error: "score_editing_closed" });
  }
}

async function getLateRoundScoreAdjustment(projectId: string, assessmentRoundId: string, rawScore: number) {
  const exceptions = await prisma.projectRoundException.findMany({
    where: { projectId, assessmentRoundId, status: "OPEN" },
    select: { exceptionType: true, status: true }
  });
  const latePenaltyRequired = requiresLateRoundPenalty(exceptions);
  return {
    rawScore,
    score: latePenaltyRequired ? applyLatePenalty(rawScore) : rawScore,
    latePenaltyRequired,
    latePenaltyPercent: latePenaltyRequired ? 10 : 0
  };
}

export async function claimTeacherProfile(formData: FormData) {
  const user = await requirePendingTeacherClaimUser();
  assertRateLimit(`teacher:${user.id}:claimTeacherProfile`, pilotRateLimits.workflowMutation);
  if (!user.email || !user.id) throw new Error("ไม่พบอีเมลผู้ใช้");
  const teacherId = String(formData.get("teacher_id"));

  const appUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  await prisma.teacherAccountClaim.upsert({
    where: { teacherId_userId: { teacherId, userId: user.id } },
    update: {
      status: "PENDING",
      claimedEmail: user.email.toLowerCase(),
      googleSub: appUser.googleSub ?? "",
      claimedNameFromGoogle: user.name
    },
    create: {
      teacherId,
      userId: user.id,
      claimedEmail: user.email.toLowerCase(),
      googleSub: appUser.googleSub ?? "",
      claimedNameFromGoogle: user.name,
      status: "PENDING"
    }
  });

  revalidatePath("/teacher/claim");
  redirect("/teacher/claim?success=teacher_claim_submitted");
}

export async function openProposalScoring(
  _previousState: ProposalStartActionResult,
  formData: FormData
): Promise<ProposalStartActionResult> {
  const requestId = crypto.randomUUID();
  const timer = createActionTimer("teacher.openProposalScoring", { requestId, enabled: true });
  let openedAssignment: { assignmentId: string; unchanged: boolean } | null = null;
  const finish = (result: ProposalStartActionResult) => {
    timer.end(result.status === "idle" ? "idle" : `${result.status}:${result.code}`);
    return result;
  };

  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.id || !hasApprovedTeacherCapability(user)) {
      return finish({ status: "conflict", code: "teacher_profile_missing", requestId });
    }
    const userId = user.id;
    assertRateLimit(`teacher:${userId}:openProposalScoring`, pilotRateLimits.workflowMutation);

    const attemptId = String(formData.get("attempt_id") ?? "").trim();
    if (!attemptId) return finish({ status: "validation", code: "proposal_attempt_missing", requestId });

    const opened = await prisma.$transaction((tx) => openProposalAssignment({
      findTeacher: (userId) => tx.teacher.findUnique({
        where: { userId },
        select: { id: true, academicPrefix: true, firstNameTh: true, lastNameTh: true, active: true, isInternal: true, canEvaluateProposal: true }
      }),
      findAttempt: async (id) => {
        const context = await tx.assessmentAttempt.findUnique({
          where: { id },
          select: { projectId: true }
        });
        if (!context) return null;
        await tx.$queryRaw`SELECT id FROM "projects" WHERE id = ${context.projectId} FOR UPDATE`;
        const attempt = await tx.assessmentAttempt.findUnique({
          where: { id },
          select: {
            id: true,
            projectId: true,
            assessmentRoundId: true,
            attemptType: true,
            status: true,
            project: { select: { status: true } },
            assessmentRound: { select: { roundType: true, status: true } },
            proposalResult: { select: { id: true } }
          }
        });
        const latestAttempt = attempt ? await tx.assessmentAttempt.findFirst({
          where: { projectId: attempt.projectId, assessmentRoundId: attempt.assessmentRoundId },
          orderBy: { attemptNo: "desc" },
          select: { id: true }
        }) : null;
        return attempt ? {
          projectId: attempt.projectId,
          assessmentRoundId: attempt.assessmentRoundId,
          attemptType: attempt.attemptType,
          attemptStatus: attempt.status,
          projectStatus: attempt.project.status,
          roundType: attempt.assessmentRound.roundType,
          roundStatus: attempt.assessmentRound.status,
          hasProposalResult: Boolean(attempt.proposalResult),
          isLatestProposalAttempt: latestAttempt?.id === attempt.id
        } : null;
      },
      hasOpenLateRoundException: async (projectId, assessmentRoundId) => {
        const exceptions = await tx.projectRoundException.findMany({
          where: { projectId, assessmentRoundId, status: "OPEN" },
          select: { exceptionType: true, status: true }
        });
        return hasOpenLateRoundException(exceptions);
      },
      findAssignment: (assessmentAttemptId, evaluatorUserId) => tx.evaluatorAssignment.findUnique({
        where: { assessmentAttemptId_evaluatorUserId: { assessmentAttemptId, evaluatorUserId } },
        select: { id: true, status: true }
      }),
      createAssignment: ({ attemptId: assessmentAttemptId, userId: evaluatorUserId, teacherId, evaluatorDisplayName }) =>
        tx.evaluatorAssignment.create({
          data: {
            assessmentAttemptId,
            evaluatorUserId,
            teacherId,
            evaluatorDisplayNameSnapshot: evaluatorDisplayName,
            status: "IN_PROGRESS",
            isRequired: false
          },
          select: { id: true, status: true }
        })
    }, { attemptId, userId }), { isolationLevel: "Serializable", maxWait: 5_000, timeout: 15_000 });

    if (opened.status === "conflict") {
      return finish({ status: "conflict", code: opened.code, requestId });
    }

    openedAssignment = {
      assignmentId: opened.assignmentId,
      unchanged: opened.unchanged
    };
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return finish({ status: "rate_limit", code: "proposal_start_rate_limited", requestId });
    }
    console.error(JSON.stringify({
      type: "action_error",
      action: "teacher.openProposalScoring",
      outcome: "unexpected",
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError"
    }));
    return finish({ status: "unexpected", code: "proposal_start_unexpected", requestId });
  }

  finish({
    status: "success",
    code: "proposal_assignment_ready",
    requestId,
    assignmentId: openedAssignment.assignmentId,
    unchanged: openedAssignment.unchanged
  });
  redirect(`/teacher/scoring/${encodeURIComponent(openedAssignment.assignmentId)}`);
}

export async function reviewAdvisorRequest(formData: FormData) {
  const user = await requireTeacherUser();
  assertRateLimit(`teacher:${user.id}:reviewAdvisorRequest`, pilotRateLimits.workflowMutation);
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");
  const requestId = String(formData.get("request_id"));
  const decision = String(formData.get("decision"));
  const comment = String(formData.get("comment") ?? "").trim();
  if (sizeError(comment, requestSizeLimits.commentTextBytes, "ข้อเสนอแนะต่อคำขอที่ปรึกษา")) {
    redirectWithQuery("/teacher/advisor-requests", { error: "advisor_request_comment_too_long" });
  }
  if (!["APPROVE", "REJECT"].includes(decision)) {
    redirectWithQuery("/teacher/advisor-requests", { error: "advisor_request_decision_invalid" });
  }
  if (decision === "REJECT" && !comment) {
    redirectWithQuery("/teacher/advisor-requests", { error: "advisor_reject_reason_required" });
  }

  const requestContext = await prisma.advisorRequest.findUnique({
    where: { id: requestId },
    select: { projectId: true }
  });
  if (!requestContext) redirectWithQuery("/teacher/advisor-requests", { error: "advisor_request_stale" });

  const reviewOutcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "projects" WHERE "id" = ${requestContext.projectId} FOR UPDATE
    `;
    const [teacher, request, latestRequest] = await Promise.all([
      tx.teacher.findUnique({ where: { userId: user.id } }),
      tx.advisorRequest.findUnique({ where: { id: requestId }, include: { project: true } }),
      tx.advisorRequest.findFirst({
        where: { projectId: requestContext.projectId },
        orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
        select: { id: true }
      })
    ]);
    if (!teacher || !request || !isCurrentAdvisorRequestReviewable({
      request,
      latestRequestId: latestRequest?.id ?? null,
      actorTeacherId: teacher.id,
      projectStatus: request.project.status
    })) {
      return { error: "advisor_request_stale" as const };
    }

    const transition = decision === "APPROVE"
      ? advisorApproveTransition(request.project.status)
      : advisorRejectTransition(request.project.status);
    await tx.advisorRequest.update({
      where: { id: requestId },
      data: {
        status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
        advisorComment: comment || null,
        reviewedAt: new Date()
      }
    });
    await tx.project.update({ where: { id: request.projectId }, data: { status: transition.to } });
    await tx.projectStatusHistory.create({
      data: {
        projectId: request.projectId,
        fromStatus: transition.from,
        toStatus: transition.to,
        reason: transition.reason,
        actorUserId: user.id,
        metadataJson: { advisorRequestId: requestId, comment: comment || null }
      }
    });
    await tx.projectTimelineEvent.create({
      data: {
        projectId: request.projectId,
        eventType: decision === "APPROVE" ? "ADVISOR_REQUEST_APPROVED" : "ADVISOR_REQUEST_REJECTED",
        eventTitle: decision === "APPROVE" ? "อาจารย์ที่ปรึกษาอนุมัติ" : "อาจารย์ที่ปรึกษาปฏิเสธ",
        eventDescription: comment || null,
        actorUserId: user.id,
        relatedEntityType: "AdvisorRequest",
        relatedEntityId: requestId
      }
    });
    return { error: null };
  }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 15_000 });
  if (reviewOutcome.error) redirectWithQuery("/teacher/advisor-requests", { error: reviewOutcome.error });

  revalidatePath("/teacher/advisor-requests");
  redirect("/teacher/advisor-requests?success=advisor_request_reviewed");
}

export async function reviewProposalRevision(
  _previousState: ProposalLifecycleActionResult,
  formData: FormData
): Promise<ProposalLifecycleActionResult> {
  return runProposalLifecycleAction("teacher.reviewProposalRevision", async (requestId) => {
    const user = await requireTeacherUser();
    const actorUserId = user.id;
    if (!actorUserId) throw new ProposalLifecycleValidationError("TEACHER_USER_REQUIRED", "ไม่พบบัญชีอาจารย์ กรุณาเข้าสู่ระบบใหม่", []);
    assertRateLimit(`teacher:${user.id}:reviewProposalRevision`, pilotRateLimits.workflowMutation);
    const projectId = String(formData.get("project_id") ?? "").trim();
    const decisionValue = String(formData.get("decision") ?? "");
    const comment = String(formData.get("comment") ?? "").trim();
    if (!projectId) throw new ProposalLifecycleValidationError("PROJECT_REQUIRED", "ไม่พบโครงงาน กรุณารีเฟรชหน้าแล้วลองใหม่", ["project_id"]);
    if (!["APPROVE", "RETURN"].includes(decisionValue)) {
      throw new ProposalLifecycleValidationError("REVISION_DECISION_INVALID", "กรุณาเลือกผลตรวจ Proposal ฉบับแก้ไข", ["decision"]);
    }
    if (decisionValue === "RETURN" && !comment) {
      throw new ProposalLifecycleValidationError("ADVISOR_RETURN_REASON_REQUIRED", "กรุณาระบุเหตุผลก่อนส่งกลับให้นักศึกษาแก้ไขเพิ่มเติม", ["comment"]);
    }
    const commentSizeError = sizeError(comment, requestSizeLimits.commentTextBytes, "เหตุผลการตรวจ Proposal ฉบับแก้ไข");
    if (commentSizeError) throw new ProposalLifecycleValidationError("REVISION_COMMENT_TOO_LONG", commentSizeError, ["comment"]);
    const markdownErrors = validateMarkdownInput(comment, "เหตุผลการตรวจ Proposal ฉบับแก้ไข");
    if (markdownErrors.length) throw new ProposalLifecycleValidationError("REVISION_COMMENT_INVALID", markdownErrors[0] ?? "ข้อความไม่ถูกต้อง", ["comment"]);

    const outcome = await reviewProposalRevisionByAdvisorAtomic(prisma, {
      actorUserId,
      requestId,
      projectId,
      decision: decisionValue === "APPROVE" ? "CERTIFY" : "RETURN",
      reason: comment || null
    });
    revalidatePath("/teacher");
    revalidatePath("/teacher/proposal-revisions");
    revalidatePath("/admin/proposals");
    revalidatePath("/admin/committee");
    revalidatePath("/student");
    revalidatePath("/student/proposal");
    return {
      status: "success",
      code: decisionValue === "APPROVE" ? "PROPOSAL_REVISION_CERTIFIED" : "PROPOSAL_REVISION_RETURNED",
      message: outcome.unchanged
        ? "ผลตรวจนี้ถูกบันทึกไว้เรียบร้อยแล้ว"
        : decisionValue === "APPROVE"
          ? "รับรอง Proposal ฉบับแก้ไขเรียบร้อยแล้ว"
          : "ส่งกลับให้นักศึกษาแก้ไขเพิ่มเติมเรียบร้อยแล้ว",
      requestId,
      unchanged: outcome.unchanged
    };
  });
}

export async function reviewExamSchedule(formData: FormData) {
  const user = await requireTeacherUser();
  assertRateLimit(`teacher:${user.id}:reviewExamSchedule`, pilotRateLimits.workflowMutation);
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");

  const scheduleId = String(formData.get("schedule_id") ?? "");
  const renderedScheduleUpdatedAt = String(formData.get("schedule_updated_at") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  redirectIfTeacherTextTooLong(comment, requestSizeLimits.commentTextBytes, "ความเห็นต่อคำขอวันสอบ", "/teacher/schedules");
  if (decision !== "APPROVE" && decision !== "REJECT") {
    redirectWithQuery("/teacher/schedules", { error: "schedule_review_decision_invalid" });
  }
  if (decision === "REJECT" && !comment) {
    redirectWithQuery("/teacher/schedules", { error: "schedule_reject_reason_required" });
  }
  if (comment) {
    const commentErrors = validateMarkdownInput(comment, "ความเห็นต่อคำขอวันสอบ");
    redirectIfTeacherMarkdownInvalid(commentErrors, "/teacher/schedules");
  }

  const teacher = await prisma.teacher.findUniqueOrThrow({ where: { userId: user.id } });
  const schedule = await prisma.examScheduleProposal.findUniqueOrThrow({
    where: { id: scheduleId },
    include: {
      assessmentRound: true,
      approvals: true,
      project: {
        include: {
          committeeAssignments: { where: { active: true } },
          advisorRequests: { where: { status: "APPROVED" } },
          roundExceptions: {
            where: { status: "OPEN" },
            include: { assessmentRound: { select: { roundType: true } } }
          }
        }
      }
    }
  });
  if (schedule.status !== "PROPOSED") {
    redirectWithQuery("/teacher/schedules", { error: "schedule_already_reviewed" });
  }
  if (!renderedScheduleUpdatedAt || schedule.updatedAt.toISOString() !== renderedScheduleUpdatedAt) {
    redirectWithQuery("/teacher/schedules", { error: "schedule_already_reviewed" });
  }
  const hasLateRoundOverride = schedule.assessmentRound
    ? schedule.project.roundExceptions.some(
        (exception) =>
          exception.assessmentRound?.roundType === schedule.assessmentRound?.roundType &&
          hasOpenLateRoundException([exception])
      )
    : false;
  if (schedule.assessmentRound && !isRoundOpen(schedule.assessmentRound.status) && !hasLateRoundOverride) {
    redirectWithQuery("/teacher/schedules", { error: "schedule_round_not_open" });
  }

  const requiredApproverIds = uniqueIds([
    ...schedule.project.committeeAssignments
      .filter((assignment) => ["ADVISOR", "HEAD", "MEMBER"].includes(assignment.role))
      .map((assignment) => assignment.teacherId),
    ...schedule.project.advisorRequests.map((request) => request.advisorTeacherId)
  ]);
  if (!requiredApproverIds.includes(teacher.id)) {
    throw new Error("เฉพาะอาจารย์ที่ปรึกษา ประธานกรรมการ หรือกรรมการของโครงงานนี้เท่านั้นที่อนุมัติวันสอบได้");
  }

  const scheduleReviewOutcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "projects" WHERE "id" = ${schedule.projectId} FOR UPDATE`;
    const currentSchedule = await tx.examScheduleProposal.findUnique({ where: { id: schedule.id } });
    if (
      !currentSchedule
      || currentSchedule.status !== "PROPOSED"
      || currentSchedule.updatedAt.toISOString() !== renderedScheduleUpdatedAt
    ) {
      return { stale: true } as const;
    }

    await tx.examScheduleApproval.upsert({
      where: { scheduleProposalId_teacherId: { scheduleProposalId: schedule.id, teacherId: teacher.id } },
      update: {
        decision,
        comment: comment || null,
        decidedAt: new Date()
      },
      create: {
        scheduleProposalId: schedule.id,
        teacherId: teacher.id,
        decision,
        comment: comment || null,
        decidedAt: new Date()
      }
    });

    const approvals = await tx.examScheduleApproval.findMany({
      where: { scheduleProposalId: schedule.id },
      select: { teacherId: true, decision: true }
    });
    const decisionByTeacher = new Map(approvals.map((approval) => [approval.teacherId, approval.decision]));
    const nextStatus = decision === "REJECT"
      ? "REJECTED"
      : requiredApproverIds.every((teacherId) => decisionByTeacher.get(teacherId) === "APPROVE")
        ? "CONFIRMED"
        : "PROPOSED";
    if (decision === "REJECT") {
      const approvedTeacherIds = approvals
        .filter((approval) => approval.decision === "APPROVE" && approval.teacherId !== teacher.id)
        .map((approval) => approval.teacherId);
      const approvedTeachers = approvedTeacherIds.length
        ? await tx.teacher.findMany({
          where: { id: { in: approvedTeacherIds }, userId: { not: null } },
          select: { id: true, userId: true }
        })
        : [];
      if (approvedTeachers.length) {
        await tx.notification.createMany({
          data: approvedTeachers.map((item) => ({
            projectId: schedule.projectId,
            userId: item.userId,
            teacherId: item.id,
            kind: "EXAM_SCHEDULE_REJECTED",
            title: "มีกรรมการไม่สะดวกตามวันสอบที่เสนอ",
            body: "รายการวันสอบนี้ถูกปฏิเสธแล้ว กรุณารอนักศึกษาเสนอวันสอบใหม่อีกครั้ง"
          }))
        });
      }
    }

    await tx.examScheduleProposal.update({
      where: { id: schedule.id },
      data: { status: nextStatus }
    });
    await tx.projectTimelineEvent.create({
      data: {
        projectId: schedule.projectId,
        eventType: decision === "APPROVE" ? "EXAM_SCHEDULE_APPROVED" : "EXAM_SCHEDULE_REJECTED",
        eventTitle: decision === "APPROVE" ? "อาจารย์อนุมัติวันสอบ" : "อาจารย์ไม่อนุมัติวันสอบ",
        eventDescription: comment || null,
        actorUserId: user.id,
        relatedEntityType: "ExamScheduleApproval",
        relatedEntityId: schedule.id,
        metadataJson: { scheduleId: schedule.id, decision, nextStatus }
      }
    });
    return { stale: false } as const;
  });

  if (scheduleReviewOutcome.stale) {
    redirectWithQuery("/teacher/schedules", { error: "schedule_already_reviewed" });
  }

  revalidatePath("/teacher");
  revalidatePath("/teacher/schedules");
  revalidatePath("/student");
  revalidatePath("/student/schedule");
  revalidatePath("/admin/schedules");
  redirectWithQuery("/teacher/schedules", { success: decision === "APPROVE" ? "schedule_approved" : "schedule_rejected" });
}

async function retiredSubmitProposalScore(
  _previousState: TeacherScoreActionResult,
  formData: FormData
): Promise<TeacherScoreActionResult> {
  const requestId = crypto.randomUUID();
  const timer = createActionTimer("teacher.submitProposalScore");
  try {
    const user = await requireTeacherUser();
    assertRateLimit(`teacher:${user.id}:submitProposalScore`, pilotRateLimits.scoring);
    if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติก่อน");

    const assignmentId = String(formData.get("assignment_id") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    const overallComment = String(formData.get("overall_comment") ?? "").trim();
    const submitMode = String(formData.get("submit_mode") ?? "");
    const rawDecision = String(formData.get("decision") ?? "");
    const validDecision = ["PASS", "PASS_WITH_REVISION", "NOT_PASS"].includes(rawDecision)
      ? rawDecision as "PASS" | "PASS_WITH_REVISION" | "NOT_PASS"
      : null;

    if (!assignmentId || !["draft", "submit"].includes(submitMode)) {
      return { status: "validation", code: "proposal_decision_invalid", requestId };
    }
    if (sizeError(reason, requestSizeLimits.shortReasonBytes, "proposal decision reason") || sizeError(overallComment, requestSizeLimits.commentTextBytes, "ข้อเสนอแนะภาพรวมการเสนอหัวข้อ")) {
      return { status: "validation", code: "teacher_text_too_long", requestId };
    }

    const assignment = await timer.measure("load_assignment", () => prisma.evaluatorAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: {
        assessmentAttempt: { include: { assessmentRound: true, proposalResult: true } },
        scoreSubmission: { select: { status: true, lockedAt: true, totalScore: true } }
      }
    }));
    if (assignment.evaluatorUserId !== user.id) throw new Error("ไม่สามารถบันทึกคะแนนของผู้อื่นได้");
    if (!assignment.teacherId) throw new Error("ไม่พบข้อมูลอาจารย์ผู้ประเมิน");
    if (assignment.assessmentAttempt.proposalResult) {
      return { status: "conflict", code: "proposal_decision_already_saved", requestId };
    }
    const proposalRoundExceptions = await prisma.projectRoundException.findMany({
      where: {
        projectId: assignment.assessmentAttempt.projectId,
        assessmentRoundId: assignment.assessmentAttempt.assessmentRoundId,
        status: "OPEN"
      },
      select: { exceptionType: true, status: true }
    });
    if (!isProposalScoreEditable({
      roundStatus: assignment.assessmentAttempt.assessmentRound.status,
      hasAdminDecision: false,
      roundExceptions: proposalRoundExceptions
    })) {
      return { status: "conflict", code: "proposal_round_not_open", requestId };
    }

    const rubric = await timer.measure("load_rubric", () => readProposalConditionRubric(prisma));
    if (!rubric?.items.length) {
      return { status: "conflict", code: "proposal_rubric_missing", requestId };
    }

    const isScoreRevision = assignment.scoreSubmission?.status === "SUBMITTED" || assignment.status === "SUBMITTED";
    const isSubmittingScore = submitMode === "submit" || isScoreRevision;
    const conditionFieldNames = rubric.items
      .filter((item) => Boolean(findProposalQaCriterion(item.itemKey)))
      .map((item) => `condition_count:${item.id}`);
    const missingFields = missingScoreFieldNames(formData, conditionFieldNames);
    if (isSubmittingScore && missingFields.length) {
      return { status: "validation", code: "score_rubric_incomplete", requestId, missingFields };
    }
    if (isSubmittingScore && !validDecision) {
      return { status: "validation", code: "proposal_decision_invalid", requestId };
    }
    if (isSubmittingScore && validateProposalDecision(validDecision!, reason).length) {
      return { status: "validation", code: "proposal_decision_reason_required", requestId };
    }
    if (isSubmittingScore && !overallComment) {
      return { status: "validation", code: "proposal_feedback_required", requestId };
    }

    const checkedIds = new Set(formData.getAll("checked_item").map(String));
    let invalidRubricValue = false;
    const conditionCounts: Record<string, number> = {};
    const scoredItems = rubric.items.flatMap((item) => {
      const proposalCriterion = findProposalQaCriterion(item.itemKey);
      if (proposalCriterion) {
        const fieldName = `condition_count:${item.id}`;
        const rawConditionCount = formData.get(fieldName);
        const conditionCount = readOptionalConditionCount(formData, fieldName);
        const conditionMax = proposalCriterion.conditions.length || proposalCriterion.requiredSections?.length || 0;
        if (conditionCount === null) {
          if (typeof rawConditionCount === "string" && rawConditionCount.trim()) invalidRubricValue = true;
          return [];
        }
        if (conditionCount > conditionMax) {
          invalidRubricValue = true;
          return [];
        }
        conditionCounts[item.id] = conditionCount;
        const pointsAwarded = calculateCriterionScore(proposalCriterion, conditionCount);
        return [{ item, checked: pointsAwarded > 0, pointsAwarded }];
      }
      if (!checkedIds.has(item.id) && !isSubmittingScore) return [];
      const checked = checkedIds.has(item.id);
      return [{ item, checked, pointsAwarded: checked ? item.points : 0 }];
    });
    if (invalidRubricValue) {
      return { status: "validation", code: "score_rubric_incomplete", requestId };
    }

    const scoreResult = {
      totalScore: scoredItems.reduce((sum, scoredItem) => sum + scoredItem.pointsAwarded, 0),
      criticalWarnings: scoredItems.filter((scoredItem) => scoredItem.item.isCritical && scoredItem.pointsAwarded === 0).map((scoredItem) => scoredItem.item.itemLabelTh)
    };
    const scoreAdjustment = await getLateRoundScoreAdjustment(
      assignment.assessmentAttempt.projectId,
      assignment.assessmentAttempt.assessmentRoundId,
      scoreResult.totalScore
    );

    await timer.measure("persist_proposal_score", () => prisma.$transaction(async (tx) => {
      const scoreSubmission = await tx.scoreSubmission.upsert({
        where: { evaluatorAssignmentId: assignmentId },
        update: {
          totalScore: scoreAdjustment.score,
          overallComment,
          status: isSubmittingScore ? "SUBMITTED" : "DRAFT",
          submittedAt: isSubmittingScore ? new Date() : null,
          lockedAt: isSubmittingScore ? new Date() : null
        },
        create: {
          evaluatorAssignmentId: assignmentId,
          totalScore: scoreAdjustment.score,
          overallComment,
          status: isSubmittingScore ? "SUBMITTED" : "DRAFT",
          submittedAt: isSubmittingScore ? new Date() : null,
          lockedAt: isSubmittingScore ? new Date() : null
        }
      });

      const selectedItemIds = scoredItems.map(({ item }) => item.id);
      if (!isSubmittingScore) {
        await tx.scoreItem.deleteMany({
          where: {
            scoreSubmissionId: scoreSubmission.id,
            ...(selectedItemIds.length ? { rubricItemId: { notIn: selectedItemIds } } : {})
          }
        });
      }
      await Promise.all(scoredItems.map(({ item, checked, pointsAwarded }) => tx.scoreItem.upsert({
        where: { scoreSubmissionId_rubricItemId: { scoreSubmissionId: scoreSubmission.id, rubricItemId: item.id } },
        update: { checked, pointsAwarded },
        create: { scoreSubmissionId: scoreSubmission.id, rubricItemId: item.id, checked, pointsAwarded }
      })));

      if (validDecision) {
        await tx.proposalEvaluatorDecision.upsert({
          where: { scoreSubmissionId: scoreSubmission.id },
          update: { decision: validDecision, reason: reason || null },
          create: { scoreSubmissionId: scoreSubmission.id, decision: validDecision, reason: reason || null }
        });
      } else if (!isSubmittingScore) {
        await tx.proposalEvaluatorDecision.deleteMany({ where: { scoreSubmissionId: scoreSubmission.id } });
      }

      if (!isSubmittingScore) {
        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            action: PROPOSAL_DRAFT_V2_AUDIT_ACTION,
            entityType: "ScoreSubmission",
            entityId: scoreSubmission.id,
            afterJson: {
              selectedRubricItemIds: selectedItemIds,
              conditionCounts,
              totalScore: scoreAdjustment.score,
              hasDecision: Boolean(validDecision),
              hasComment: Boolean(overallComment)
            },
            metadataJson: { requestId, assignmentId }
          }
        });
        return;
      }

      await tx.proposalVote.upsert({
        where: {
          projectId_teacherId_assessmentAttemptId: {
            projectId: assignment.assessmentAttempt.projectId,
            teacherId: assignment.teacherId!,
            assessmentAttemptId: assignment.assessmentAttemptId
          }
        },
        update: {
          vote: validDecision === "PASS" ? "PASS" : validDecision === "PASS_WITH_REVISION" ? "REVISE" : "FAIL",
          comment: overallComment || reason || null,
          visibleToStudent: true,
          submittedAt: new Date()
        },
        create: {
          projectId: assignment.assessmentAttempt.projectId,
          assessmentAttemptId: assignment.assessmentAttemptId,
          teacherId: assignment.teacherId!,
          vote: validDecision === "PASS" ? "PASS" : validDecision === "PASS_WITH_REVISION" ? "REVISE" : "FAIL",
          comment: overallComment || reason || null,
          visibleToStudent: true
        }
      });
      await tx.evaluatorAssignment.update({ where: { id: assignmentId }, data: { status: "SUBMITTED" } });
      const remainingAssignments = await tx.evaluatorAssignment.count({
        where: { assessmentAttemptId: assignment.assessmentAttemptId, status: { not: "SUBMITTED" } }
      });
      if (remainingAssignments === 0) {
        const project = await tx.project.findUniqueOrThrow({ where: { id: assignment.assessmentAttempt.projectId } });
        if (project.status === "PROPOSAL_REVIEW") {
          await tx.project.update({ where: { id: project.id }, data: { status: "PROPOSAL_ADMIN_DECISION" } });
          await tx.projectStatusHistory.create({
            data: {
              projectId: project.id,
              fromStatus: "PROPOSAL_REVIEW",
              toStatus: "PROPOSAL_ADMIN_DECISION",
              reason: "ALL_PROPOSAL_SCORES_SUBMITTED",
              actorUserId: user.id
            }
          });
        }
      }
      await tx.projectTimelineEvent.create({
        data: {
          projectId: assignment.assessmentAttempt.projectId,
          eventType: "TEACHER_SCORE_SUBMITTED",
          eventTitle: isScoreRevision ? "อาจารย์แก้ไขคะแนนการเสนอหัวข้อ" : "อาจารย์ส่งคะแนนการเสนอหัวข้อ",
          actorUserId: user.id,
          relatedEntityType: "ScoreSubmission",
          relatedEntityId: scoreSubmission.id,
          metadataJson: {
            totalScore: scoreAdjustment.score,
            rawTotalScore: scoreAdjustment.rawScore,
            latePenaltyRequired: scoreAdjustment.latePenaltyRequired,
            latePenaltyPercent: scoreAdjustment.latePenaltyPercent,
            isRevision: isScoreRevision,
            previousTotalScore: isScoreRevision && assignment.scoreSubmission ? Number(assignment.scoreSubmission.totalScore) : null,
            criticalWarnings: scoreResult.criticalWarnings,
            requestId
          }
        }
      });
    }));

    revalidatePath(`/teacher/scoring/${assignmentId}`);
    if (isSubmittingScore) {
      revalidatePath("/teacher");
      revalidatePath("/teacher/proposals");
      revalidatePath("/student/proposal");
      revalidatePath("/admin");
      revalidatePath("/admin/proposals");
    }
    timer.end("result");
    return {
      status: "success",
      code: isSubmittingScore ? (isScoreRevision ? "proposal_score_updated" : "proposal_score_submitted") : "proposal_score_draft_saved",
      requestId
    };
  } catch (error) {
    console.error("[teacher.submitProposalScore] unexpected failure", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    timer.end("unexpected");
    return { status: "unexpected", code: "proposal_score_unexpected", requestId };
  }
}

export async function readProgress1Rubric() {
  return readActiveAssessmentRubric(prisma, "PROGRESS_1");
}

export async function readProgress2Rubric() {
  return readActiveAssessmentRubric(prisma, "PROGRESS_2");
}

export async function readFinalRubric() {
  return readActiveAssessmentRubric(prisma, "FINAL_PRESENTATION");
}

async function retiredSubmitProgress1Score(formData: FormData) {
  const user = await requireTeacherUser();
  assertRateLimit(`teacher:${user.id}:submitProgress1Score`, pilotRateLimits.scoring);
  const timer = createActionTimer("teacher.submitProgress1Score");
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");
  const projectId = String(formData.get("project_id") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  redirectIfTeacherTextTooLong(comment, requestSizeLimits.commentTextBytes, "ข้อเสนอแนะการสอบความก้าวหน้าครั้งที่ 1", "/teacher/progress1");
  const input: Progress1ScoreInput = {
    progress: Number(formData.get("progress")),
    problemSolving: Number(formData.get("problem_solving")),
    researchResults: Number(formData.get("research_results")),
    presentation: Number(formData.get("presentation")),
    overall: Number(formData.get("overall"))
  };
  const errors = validateProgress1Score(input);
  if (comment) errors.push(...validateMarkdownInput(comment, "ข้อเสนอแนะการสอบความก้าวหน้าครั้งที่ 1"));
  redirectIfTeacherFormInvalid(errors, "/teacher/progress1");

  const teacher = await timer.measure("load_teacher", () => prisma.teacher.findUniqueOrThrow({ where: { userId: user.id } }));
  const project = await timer.measure("load_project", () => prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { committeeAssignments: true }
  }));
  if (project.status !== "IN_PROGRESS") throw new Error("บันทึกคะแนนความก้าวหน้าครั้งที่ 1 ได้เฉพาะโครงงานที่อยู่ระหว่างดำเนินงาน");
  const assigned = project.committeeAssignments.some(
    (assignment) => assignment.active && assignment.teacherId === teacher.id && ["HEAD", "MEMBER"].includes(assignment.role)
  );
  if (!assigned) throw new Error("เฉพาะประธานกรรมการหรือกรรมการที่ได้รับแต่งตั้งเท่านั้นที่บันทึกคะแนนความก้าวหน้าครั้งที่ 1 ได้");
  await assertConfirmedSchedule(project.id, "PROGRESS_1", "การสอบความก้าวหน้าครั้งที่ 1");

  const round = await timer.measure("load_round", () => prisma.assessmentRound.findUniqueOrThrow({
    where: { courseOfferingId_roundType: { courseOfferingId: project.courseOfferingId, roundType: "PROGRESS_1" } }
  }));
  await assertPresentationScoreRoundEditable(project.id, round.id, round.status, "/teacher/progress1");
  const rubric = await timer.measure("read_rubric", () => readProgress1Rubric());
  if (!rubric?.items.length) redirectWithQuery("/teacher/progress1", { error: "score_rubric_missing" });
  redirectIfScoreFieldsIncomplete(
    formData,
    rubric.items.map((item) => findProgressQaCriterion(item.itemKey) ? `condition_count:${item.id}` : progressScoreFieldName(item.itemKey)),
    "/teacher/progress1"
  );
  const valuesByKey: Record<string, number> = {
    progress: input.progress,
    problemSolving: input.problemSolving,
    researchResults: input.researchResults,
    presentation: input.presentation,
    overall: input.overall
  };
  const scoredItems = rubric.items.map((item) => {
    const progressCriterion = findProgressQaCriterion(item.itemKey);
    if (progressCriterion) {
      const rawConditionCount = Number(formData.get(`condition_count:${item.id}`) ?? 0);
      const conditionCount = Number.isFinite(rawConditionCount) ? rawConditionCount : 0;
      const pointsAwarded = calculateProgressQaCriterionScore(progressCriterion, conditionCount);
      return { item, checked: pointsAwarded > 0, pointsAwarded };
    }

    const pointsAwarded = valuesByKey[item.itemKey] ?? 0;
    return { item, checked: pointsAwarded > 0, pointsAwarded };
  });
  const progressTotalScore = scoredItems.reduce((sum, scoredItem) => sum + scoredItem.pointsAwarded, 0);
  const scoreAdjustment = await getLateRoundScoreAdjustment(project.id, round.id, progressTotalScore);
  const attempt = await prisma.assessmentAttempt.upsert({
    where: {
      projectId_assessmentRoundId_attemptNo: {
        projectId: project.id,
        assessmentRoundId: round.id,
        attemptNo: 1
      }
    },
    update: { status: "SCORING_OPEN", attemptType: "PROGRESS_1" },
    create: { projectId: project.id, assessmentRoundId: round.id, attemptNo: 1, attemptType: "PROGRESS_1", status: "SCORING_OPEN" }
  });
  const assignment = await prisma.evaluatorAssignment.upsert({
    where: { assessmentAttemptId_evaluatorUserId: { assessmentAttemptId: attempt.id, evaluatorUserId: user.id } },
    update: {
      teacherId: teacher.id,
      evaluatorDisplayNameSnapshot: `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`,
      status: "SUBMITTED"
    },
    create: {
      assessmentAttemptId: attempt.id,
      evaluatorUserId: user.id,
      teacherId: teacher.id,
      evaluatorDisplayNameSnapshot: `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`,
      status: "SUBMITTED",
      isRequired: true
    }
  });
  const previousSubmission = await prisma.scoreSubmission.findUnique({
    where: { evaluatorAssignmentId: assignment.id },
    select: { totalScore: true }
  });
  const scoreSubmission = await prisma.scoreSubmission.upsert({
    where: { evaluatorAssignmentId: assignment.id },
    update: { totalScore: scoreAdjustment.score, overallComment: comment || null, status: "SUBMITTED", submittedAt: new Date(), lockedAt: new Date() },
    create: { evaluatorAssignmentId: assignment.id, totalScore: scoreAdjustment.score, overallComment: comment || null, status: "SUBMITTED", submittedAt: new Date(), lockedAt: new Date() }
  });

  await timer.measure("upsert_score_items", () => Promise.all(
    scoredItems.map(({ item, checked, pointsAwarded }) =>
      prisma.scoreItem.upsert({
        where: { scoreSubmissionId_rubricItemId: { scoreSubmissionId: scoreSubmission.id, rubricItemId: item.id } },
        update: { checked, pointsAwarded },
        create: { scoreSubmissionId: scoreSubmission.id, rubricItemId: item.id, checked, pointsAwarded }
      })
    )
  ));
  await timer.measure("create_timeline", () => prisma.projectTimelineEvent.create({
    data: {
      projectId: project.id,
      eventType: "PROGRESS_1_SCORE_SUBMITTED",
      eventTitle: previousSubmission ? "แก้ไขคะแนนการสอบความก้าวหน้าครั้งที่ 1" : "บันทึกคะแนนการสอบความก้าวหน้าครั้งที่ 1",
      eventDescription: comment || null,
      actorUserId: user.id,
      relatedEntityType: "ScoreSubmission",
      relatedEntityId: scoreSubmission.id,
      metadataJson: {
        totalScore: scoreAdjustment.score,
        rawTotalScore: scoreAdjustment.rawScore,
        latePenaltyRequired: scoreAdjustment.latePenaltyRequired,
        latePenaltyPercent: scoreAdjustment.latePenaltyPercent,
        isRevision: Boolean(previousSubmission),
        previousTotalScore: previousSubmission ? Number(previousSubmission.totalScore) : null
      }
    }
  }));

  revalidatePath("/teacher/progress1");
  revalidatePath("/teacher");
  revalidatePath("/student");
  timer.end("redirect");
  redirect(`/teacher/progress1?success=${previousSubmission ? "progress_1_score_updated" : "progress_1_score_saved"}`);
}

async function retiredSubmitProgress2Score(formData: FormData) {
  const user = await requireTeacherUser();
  assertRateLimit(`teacher:${user.id}:submitProgress2Score`, pilotRateLimits.scoring);
  const timer = createActionTimer("teacher.submitProgress2Score");
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");
  const projectId = String(formData.get("project_id") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  redirectIfTeacherTextTooLong(comment, requestSizeLimits.commentTextBytes, "ข้อเสนอแนะการสอบความก้าวหน้าครั้งที่ 2", "/teacher/progress2");
  const input: Progress2ScoreInput = {
    progress: Number(formData.get("progress")),
    problemSolving: Number(formData.get("problem_solving")),
    researchResults: Number(formData.get("research_results")),
    presentation: Number(formData.get("presentation")),
    overall: Number(formData.get("overall"))
  };
  const errors = validateProgress2Score(input);
  if (comment) errors.push(...validateMarkdownInput(comment, "ข้อเสนอแนะการสอบความก้าวหน้าครั้งที่ 2"));
  redirectIfTeacherFormInvalid(errors, "/teacher/progress2");

  const teacher = await timer.measure("load_teacher", () => prisma.teacher.findUniqueOrThrow({ where: { userId: user.id } }));
  const project = await timer.measure("load_project", () => prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { committeeAssignments: true }
  }));
  if (project.status !== "IN_PROGRESS") throw new Error("บันทึกคะแนนความก้าวหน้าครั้งที่ 2 ได้เฉพาะโครงงานที่อยู่ระหว่างดำเนินงาน");
  const assigned = project.committeeAssignments.some(
    (assignment) => assignment.active && assignment.teacherId === teacher.id && ["HEAD", "MEMBER"].includes(assignment.role)
  );
  if (!assigned) throw new Error("เฉพาะประธานกรรมการหรือกรรมการที่ได้รับแต่งตั้งเท่านั้นที่บันทึกคะแนนความก้าวหน้าครั้งที่ 2 ได้");
  await assertConfirmedSchedule(project.id, "PROGRESS_2", "การสอบความก้าวหน้าครั้งที่ 2");

  const round = await timer.measure("load_round", () => prisma.assessmentRound.findUniqueOrThrow({
    where: { courseOfferingId_roundType: { courseOfferingId: project.courseOfferingId, roundType: "PROGRESS_2" } }
  }));
  await assertPresentationScoreRoundEditable(project.id, round.id, round.status, "/teacher/progress2");
  const rubric = await timer.measure("read_rubric", () => readProgress2Rubric());
  if (!rubric?.items.length) redirectWithQuery("/teacher/progress2", { error: "score_rubric_missing" });
  redirectIfScoreFieldsIncomplete(
    formData,
    rubric.items.map((item) => findProgressQaCriterion(item.itemKey) ? `condition_count:${item.id}` : progressScoreFieldName(item.itemKey)),
    "/teacher/progress2"
  );
  const valuesByKey: Record<string, number> = {
    progress: input.progress,
    problemSolving: input.problemSolving,
    researchResults: input.researchResults,
    presentation: input.presentation,
    overall: input.overall
  };
  const scoredItems = rubric.items.map((item) => {
    const progressCriterion = findProgressQaCriterion(item.itemKey);
    if (progressCriterion) {
      const rawConditionCount = Number(formData.get(`condition_count:${item.id}`) ?? 0);
      const conditionCount = Number.isFinite(rawConditionCount) ? rawConditionCount : 0;
      const pointsAwarded = calculateProgressQaCriterionScore(progressCriterion, conditionCount);
      return { item, checked: pointsAwarded > 0, pointsAwarded };
    }

    const pointsAwarded = valuesByKey[item.itemKey] ?? 0;
    return { item, checked: pointsAwarded > 0, pointsAwarded };
  });
  const progressTotalScore = scoredItems.reduce((sum, scoredItem) => sum + scoredItem.pointsAwarded, 0);
  const scoreAdjustment = await getLateRoundScoreAdjustment(project.id, round.id, progressTotalScore);
  const attempt = await prisma.assessmentAttempt.upsert({
    where: {
      projectId_assessmentRoundId_attemptNo: {
        projectId: project.id,
        assessmentRoundId: round.id,
        attemptNo: 1
      }
    },
    update: { status: "SCORING_OPEN", attemptType: "PROGRESS_2" },
    create: { projectId: project.id, assessmentRoundId: round.id, attemptNo: 1, attemptType: "PROGRESS_2", status: "SCORING_OPEN" }
  });
  const assignment = await prisma.evaluatorAssignment.upsert({
    where: { assessmentAttemptId_evaluatorUserId: { assessmentAttemptId: attempt.id, evaluatorUserId: user.id } },
    update: {
      teacherId: teacher.id,
      evaluatorDisplayNameSnapshot: `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`,
      status: "SUBMITTED"
    },
    create: {
      assessmentAttemptId: attempt.id,
      evaluatorUserId: user.id,
      teacherId: teacher.id,
      evaluatorDisplayNameSnapshot: `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`,
      status: "SUBMITTED",
      isRequired: true
    }
  });
  const previousSubmission = await prisma.scoreSubmission.findUnique({
    where: { evaluatorAssignmentId: assignment.id },
    select: { totalScore: true }
  });
  const scoreSubmission = await prisma.scoreSubmission.upsert({
    where: { evaluatorAssignmentId: assignment.id },
    update: { totalScore: scoreAdjustment.score, overallComment: comment || null, status: "SUBMITTED", submittedAt: new Date(), lockedAt: new Date() },
    create: { evaluatorAssignmentId: assignment.id, totalScore: scoreAdjustment.score, overallComment: comment || null, status: "SUBMITTED", submittedAt: new Date(), lockedAt: new Date() }
  });

  await timer.measure("upsert_score_items", () => Promise.all(
    scoredItems.map(({ item, checked, pointsAwarded }) =>
      prisma.scoreItem.upsert({
        where: { scoreSubmissionId_rubricItemId: { scoreSubmissionId: scoreSubmission.id, rubricItemId: item.id } },
        update: { checked, pointsAwarded },
        create: { scoreSubmissionId: scoreSubmission.id, rubricItemId: item.id, checked, pointsAwarded }
      })
    )
  ));
  await timer.measure("create_timeline", () => prisma.projectTimelineEvent.create({
    data: {
      projectId: project.id,
      eventType: "PROGRESS_2_SCORE_SUBMITTED",
      eventTitle: previousSubmission ? "แก้ไขคะแนนการสอบความก้าวหน้าครั้งที่ 2" : "บันทึกคะแนนการสอบความก้าวหน้าครั้งที่ 2",
      eventDescription: comment || null,
      actorUserId: user.id,
      relatedEntityType: "ScoreSubmission",
      relatedEntityId: scoreSubmission.id,
      metadataJson: {
        totalScore: scoreAdjustment.score,
        rawTotalScore: scoreAdjustment.rawScore,
        latePenaltyRequired: scoreAdjustment.latePenaltyRequired,
        latePenaltyPercent: scoreAdjustment.latePenaltyPercent,
        isRevision: Boolean(previousSubmission),
        previousTotalScore: previousSubmission ? Number(previousSubmission.totalScore) : null
      }
    }
  }));

  revalidatePath("/teacher/progress2");
  revalidatePath("/teacher");
  revalidatePath("/student");
  timer.end("redirect");
  redirect(`/teacher/progress2?success=${previousSubmission ? "progress_2_score_updated" : "progress_2_score_saved"}`);
}

async function retiredSubmitFinalPresentationScore(formData: FormData) {
  const user = await requireTeacherUser();
  assertRateLimit(`teacher:${user.id}:submitFinalPresentationScore`, pilotRateLimits.scoring);
  const timer = createActionTimer("teacher.submitFinalPresentationScore");
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");
  const projectId = String(formData.get("project_id") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  redirectIfTeacherTextTooLong(comment, requestSizeLimits.commentTextBytes, "ข้อเสนอแนะการสอบนำเสนอขั้นสุดท้าย", "/teacher/final");
  const errors: string[] = [];
  if (comment) errors.push(...validateMarkdownInput(comment, "ข้อเสนอแนะการสอบนำเสนอขั้นสุดท้าย"));
  redirectIfTeacherMarkdownInvalid(errors, "/teacher/final");

  const teacher = await timer.measure("load_teacher", () => prisma.teacher.findUniqueOrThrow({ where: { userId: user.id } }));
  const project = await timer.measure("load_project", () => prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { committeeAssignments: true }
  }));
  if (project.status !== "IN_PROGRESS" && project.status !== "FINAL_DONE") {
    throw new Error("บันทึกคะแนนสอบนำเสนอขั้นสุดท้ายได้เฉพาะโครงงานที่อยู่ระหว่างดำเนินงานหรือรอยืนยันปิดรอบ Final");
  }
  const assigned = project.committeeAssignments.some(
    (assignment) => assignment.active && assignment.teacherId === teacher.id && ["HEAD", "MEMBER"].includes(assignment.role)
  );
  if (!assigned) throw new Error("เฉพาะประธานกรรมการหรือกรรมการที่ได้รับแต่งตั้งเท่านั้นที่บันทึกคะแนนสอบนำเสนอขั้นสุดท้ายได้");
  await assertConfirmedSchedule(project.id, "FINAL_PRESENT", "การสอบนำเสนอขั้นสุดท้าย");

  const round = await timer.measure("load_round", () => prisma.assessmentRound.findUnique({
    where: { courseOfferingId_roundType: { courseOfferingId: project.courseOfferingId, roundType: "FINAL_PRESENTATION" } }
  }));
  if (!round) throw new Error("ยังไม่มีรอบสอบนำเสนอขั้นสุดท้ายระดับรายวิชา");

  await assertPresentationScoreRoundEditable(project.id, round.id, round.status, "/teacher/final");
  const rubric = await timer.measure("read_rubric", () => readFinalRubric());
  if (!rubric?.items.length) redirectWithQuery("/teacher/final", { error: "score_rubric_missing" });
  redirectIfScoreFieldsIncomplete(
    formData,
    rubric.items.map((item) => `condition_count:${item.itemKey}`),
    "/teacher/final"
  );
  const scoredItems = rubric.items.map((item) => {
    const qaCriterion = findFinalQaCriterion(item.itemKey);
    if (qaCriterion) {
      const rawConditionCount = Number(formData.get(`condition_count:${item.itemKey}`) ?? 0);
      const conditionCount = Number.isFinite(rawConditionCount) ? rawConditionCount : 0;
      const pointsAwarded = calculateFinalQaCriterionScore(qaCriterion, conditionCount);
      return { item, checked: pointsAwarded > 0, pointsAwarded };
    }

    return { item, checked: false, pointsAwarded: 0 };
  });
  const finalTotalScore = scoredItems.reduce((sum, scoredItem) => sum + scoredItem.pointsAwarded, 0);
  const scoreAdjustment = await getLateRoundScoreAdjustment(project.id, round.id, finalTotalScore);
  const attempt = await prisma.assessmentAttempt.upsert({
    where: {
      projectId_assessmentRoundId_attemptNo: {
        projectId: project.id,
        assessmentRoundId: round.id,
        attemptNo: 1
      }
    },
    update: { status: "SCORING_OPEN", attemptType: "FINAL_PRESENTATION" },
    create: { projectId: project.id, assessmentRoundId: round.id, attemptNo: 1, attemptType: "FINAL_PRESENTATION", status: "SCORING_OPEN" }
  });
  const assignment = await prisma.evaluatorAssignment.upsert({
    where: { assessmentAttemptId_evaluatorUserId: { assessmentAttemptId: attempt.id, evaluatorUserId: user.id } },
    update: {
      teacherId: teacher.id,
      evaluatorDisplayNameSnapshot: `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`,
      status: "SUBMITTED"
    },
    create: {
      assessmentAttemptId: attempt.id,
      evaluatorUserId: user.id,
      teacherId: teacher.id,
      evaluatorDisplayNameSnapshot: `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`,
      status: "SUBMITTED",
      isRequired: true
    }
  });
  const previousSubmission = await prisma.scoreSubmission.findUnique({
    where: { evaluatorAssignmentId: assignment.id },
    select: { totalScore: true }
  });
  const scoreSubmission = await prisma.scoreSubmission.upsert({
    where: { evaluatorAssignmentId: assignment.id },
    update: {
      totalScore: scoreAdjustment.score,
      overallComment: comment || null,
      status: "SUBMITTED",
      submittedAt: new Date(),
      lockedAt: new Date()
    },
    create: {
      evaluatorAssignmentId: assignment.id,
      totalScore: scoreAdjustment.score,
      overallComment: comment || null,
      status: "SUBMITTED",
      submittedAt: new Date(),
      lockedAt: new Date()
    }
  });

  await timer.measure("upsert_score_items", () => Promise.all(
    scoredItems.map(({ item, checked, pointsAwarded }) =>
      prisma.scoreItem.upsert({
        where: { scoreSubmissionId_rubricItemId: { scoreSubmissionId: scoreSubmission.id, rubricItemId: item.id } },
        update: { checked, pointsAwarded },
        create: { scoreSubmissionId: scoreSubmission.id, rubricItemId: item.id, checked, pointsAwarded }
      })
    )
  ));
  await timer.measure("create_timeline", () => prisma.projectTimelineEvent.create({
    data: {
      projectId: project.id,
      eventType: "FINAL_PRESENTATION_SCORE_SUBMITTED",
      eventTitle: previousSubmission ? "แก้ไขคะแนนการสอบนำเสนอขั้นสุดท้าย" : "บันทึกคะแนนการสอบนำเสนอขั้นสุดท้าย",
      eventDescription: comment || null,
      actorUserId: user.id,
      relatedEntityType: "ScoreSubmission",
      relatedEntityId: scoreSubmission.id,
      metadataJson: {
        rubricMode: "condition_based_final",
        totalScore: scoreAdjustment.score,
        rawTotalScore: scoreAdjustment.rawScore,
        latePenaltyRequired: scoreAdjustment.latePenaltyRequired,
        latePenaltyPercent: scoreAdjustment.latePenaltyPercent,
        isRevision: Boolean(previousSubmission),
        previousTotalScore: previousSubmission ? Number(previousSubmission.totalScore) : null
      }
    }
  }));

  const completedAttempt = await timer.measure("load_final_completion_evidence", () => prisma.assessmentAttempt.findUnique({
    where: { id: attempt.id },
    select: {
      evaluatorAssignments: {
        select: {
          teacherId: true,
          scoreSubmission: { select: { status: true } }
        }
      }
    }
  }));
  const finalCompleteByScores = isPresentationAssessmentComplete({
    roundStatus: round.status,
    committeeAssignments: project.committeeAssignments,
    scoreSubmissions: completedAttempt?.evaluatorAssignments.map((completedAssignment) => ({
      teacherId: completedAssignment.teacherId,
      status: completedAssignment.scoreSubmission?.status ?? null
    })) ?? []
  });
  if (finalCompleteByScores) {
    await timer.measure("mark_final_done", () => prisma.$transaction(async (tx) => {
      const updated = await tx.project.updateMany({
        where: { id: project.id, status: "IN_PROGRESS" },
        data: { status: "FINAL_DONE" }
      });
      if (updated.count === 1) {
        await tx.projectStatusHistory.create({
          data: {
            projectId: project.id,
            fromStatus: "IN_PROGRESS",
            toStatus: "FINAL_DONE",
            reason: "FINAL_PRESENTATION_SCORES_COMPLETED",
            actorUserId: user.id,
            metadataJson: { assessmentRoundId: round.id, assessmentAttemptId: attempt.id }
          }
        });
        await tx.projectTimelineEvent.create({
          data: {
            projectId: project.id,
            eventType: "FINAL_PRESENTATION_DONE",
            eventTitle: "การสอบนำเสนอขั้นสุดท้ายเสร็จสิ้น",
            eventDescription: "กรรมการบันทึกคะแนนสอบนำเสนอขั้นสุดท้ายครบตามคณะกรรมการแล้ว นักศึกษาสามารถส่งรายงานฉบับสมบูรณ์ได้",
            actorUserId: user.id,
            relatedEntityType: "AssessmentAttempt",
            relatedEntityId: attempt.id
          }
        });
      }
    }));
  }

  revalidatePath("/teacher/final");
  revalidatePath("/teacher");
  revalidatePath("/student");
  revalidatePath("/student/report");
  timer.end("redirect");
  redirect(`/teacher/final?success=${previousSubmission ? "final_score_updated" : "final_score_saved"}`);
}

// Keep the retired implementations available for a post-semester cleanup diff,
// but do not export them as callable Server Actions.
void retiredSubmitProposalScore;
void retiredSubmitProgress1Score;
void retiredSubmitProgress2Score;
void retiredSubmitFinalPresentationScore;

export async function reviewReportVersion(formData: FormData) {
  const user = await requireTeacherUser();
  assertRateLimit(`teacher:${user.id}:reviewReportVersion`, pilotRateLimits.workflowMutation);
  const timer = createActionTimer("teacher.reviewReportVersion");
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");
  const reportVersionId = String(formData.get("report_version_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  redirectIfTeacherTextTooLong(comment, requestSizeLimits.commentTextBytes, "ข้อเสนอแนะการตรวจรายงาน", "/teacher/reports");
  if (decision !== "PASS" && decision !== "FAIL") {
    redirectWithQuery("/teacher/reports", { error: "report_review_decision_invalid" });
  }
  if (!comment) {
    redirectWithQuery("/teacher/reports", { error: "report_review_comment_required" });
  }
  const commentErrors = validateMarkdownInput(comment, "ข้อเสนอแนะการตรวจรายงาน");
  redirectIfTeacherMarkdownInvalid(commentErrors, "/teacher/reports");

  const teacher = await timer.measure("load_teacher", () => prisma.teacher.findUniqueOrThrow({ where: { userId: user.id } }));
  const reportVersion = await timer.measure("load_report_version", () => prisma.reportVersion.findUniqueOrThrow({
    where: { id: reportVersionId },
    include: {
      reviews: true,
      project: {
        include: {
          committeeAssignments: true,
          advisorRequests: true,
          reportVersions: { orderBy: { versionNo: "desc" }, take: 1 }
        }
      }
    }
  }));
  if (reportVersion.project.status !== "REPORT_REVIEW") {
    redirectWithQuery("/teacher/reports", { error: "report_stale_version" });
  }
  if (reportVersion.project.reportVersions[0]?.id !== reportVersion.id) {
    redirectWithQuery("/teacher/reports", { error: "report_stale_version" });
  }
  if (
    !isAssignedReportReviewer({
      teacherId: teacher.id,
      committeeAssignments: reportVersion.project.committeeAssignments,
      advisorRequests: reportVersion.project.advisorRequests
    })
  ) {
    throw new Error("เฉพาะอาจารย์ที่ปรึกษา ประธานกรรมการ หรือกรรมการที่ได้รับแต่งตั้งเท่านั้นที่ตรวจรายงานได้");
  }

  const requiredReviewerIds = requiredReportReviewerIds(
    reportVersion.project.committeeAssignments,
    reportVersion.project.advisorRequests
  );
  const reviewOutcome = await timer.measure("review_transaction", () => prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "projects" WHERE "id" = ${reportVersion.projectId} FOR UPDATE`;
    const [currentProject, latestReportVersion] = await Promise.all([
      tx.project.findUnique({ where: { id: reportVersion.projectId }, select: { status: true } }),
      tx.reportVersion.findFirst({
        where: { projectId: reportVersion.projectId },
        orderBy: { versionNo: "desc" },
        select: { id: true }
      })
    ]);
    if (currentProject?.status !== "REPORT_REVIEW" || latestReportVersion?.id !== reportVersion.id) {
      return { stale: true, approved: false, revisionRequested: false } as const;
    }

    const review = await tx.reportReview.upsert({
      where: {
        reportVersionId_reviewerTeacherId: {
          reportVersionId: reportVersion.id,
          reviewerTeacherId: teacher.id
        }
      },
      update: {
        decision,
        comment,
        reviewedAt: new Date()
      },
      create: {
        reportVersionId: reportVersion.id,
        reviewerTeacherId: teacher.id,
        decision,
        comment
      }
    });

    if (decision === "FAIL") {
      await tx.projectTimelineEvent.create({
        data: {
          projectId: reportVersion.projectId,
          eventType: "REPORT_REVISION_REQUESTED",
          eventTitle: "ขอให้นักศึกษาแก้ไขเล่มรายงาน",
          eventDescription: comment,
          actorUserId: user.id,
          relatedEntityType: "ReportReview",
          relatedEntityId: review.id,
          metadataJson: { reportVersionId: reportVersion.id, versionNo: reportVersion.versionNo }
        }
      });
      return { stale: false, approved: false, revisionRequested: true } as const;
    }

    const latestReviews = await tx.reportReview.findMany({
      where: { reportVersionId: reportVersion.id }
    });
    const approved =
      !latestReportVersionHasRevisionRequest(latestReviews) &&
      allRequiredReportReviewersPassed({ requiredReviewerIds, reviews: latestReviews });

    await tx.projectTimelineEvent.create({
      data: {
        projectId: reportVersion.projectId,
        eventType: "REPORT_REVIEW_PASSED_BY_REVIEWER",
        eventTitle: "อาจารย์อนุมัติรายงานฉบับสมบูรณ์",
        eventDescription: comment,
        actorUserId: user.id,
        relatedEntityType: "ReportReview",
        relatedEntityId: review.id,
        metadataJson: { reportVersionId: reportVersion.id, versionNo: reportVersion.versionNo }
      }
    });

    if (approved) {
      await tx.project.update({
        where: { id: reportVersion.projectId },
        data: { status: "REPORT_APPROVED" }
      });
      await tx.projectStatusHistory.create({
        data: {
          projectId: reportVersion.projectId,
          fromStatus: "REPORT_REVIEW",
          toStatus: "REPORT_APPROVED",
          reason: "ALL_REPORT_REVIEWERS_PASSED",
          actorUserId: user.id,
          metadataJson: { reportVersionId: reportVersion.id, requiredReviewerIds }
        }
      });
      await tx.projectTimelineEvent.create({
        data: {
          projectId: reportVersion.projectId,
          eventType: "REPORT_APPROVED",
          eventTitle: "รายงานฉบับสมบูรณ์ผ่านการตรวจครบทุกท่าน",
          actorUserId: user.id,
          relatedEntityType: "ReportVersion",
          relatedEntityId: reportVersion.id,
          metadataJson: { versionNo: reportVersion.versionNo, requiredReviewerIds }
        }
      });
    }
    return { stale: false, approved, revisionRequested: false } as const;
  }));

  if (reviewOutcome.stale) {
    redirectWithQuery("/teacher/reports", { error: "report_stale_version" });
  }
  if (reviewOutcome.revisionRequested) {
    revalidatePath("/teacher/reports");
    revalidatePath("/student/report");
    timer.end("redirect_revision");
    redirect("/teacher/reports?success=report_revision_requested");
  }

  revalidatePath("/teacher/reports");
  revalidatePath("/student/report");
  timer.end("redirect");
  redirect(reviewOutcome.approved ? "/teacher/reports?success=report_approved" : "/teacher/reports?success=report_review_saved");
}

export async function submitAdvisorScore(formData: FormData) {
  const user = await requireTeacherUser();
  assertRateLimit(`teacher:${user.id}:submitAdvisorScore`, pilotRateLimits.scoring);
  const timer = createActionTimer("teacher.submitAdvisorScore");
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");
  const projectId = String(formData.get("project_id") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  redirectIfTeacherTextTooLong(comment, requestSizeLimits.commentTextBytes, "ข้อเสนอแนะคะแนนสรุปของอาจารย์ที่ปรึกษา", "/teacher/advisor-score");
  redirectIfScoreFieldsIncomplete(
    formData,
    ["responsibility", "research_process", "problem_solving", "communication", "professionalism"],
    "/teacher/advisor-score"
  );
  const input: AdvisorScoreInput = {
    responsibility: Number(formData.get("responsibility")),
    researchProcess: Number(formData.get("research_process")),
    problemSolving: Number(formData.get("problem_solving")),
    communication: Number(formData.get("communication")),
    professionalism: Number(formData.get("professionalism"))
  };
  const errors = validateAdvisorScore(input);
  if (comment) errors.push(...validateMarkdownInput(comment, "ข้อเสนอแนะคะแนนสรุปของอาจารย์ที่ปรึกษา"));
  redirectIfTeacherFormInvalid(errors, "/teacher/advisor-score");

  const teacher = await timer.measure("load_teacher", () => prisma.teacher.findUniqueOrThrow({ where: { userId: user.id } }));
  const project = await timer.measure("load_project", () => prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      advisorRequests: true,
      committeeAssignments: true,
      advisorScore: true
    }
  }));
  const isAdvisor =
    project.advisorRequests.some((request) => request.status === "APPROVED" && request.advisorTeacherId === teacher.id) ||
    project.committeeAssignments.some((assignment) => assignment.active && assignment.role === "ADVISOR" && assignment.teacherId === teacher.id);
  if (!isAdvisor) throw new Error("เฉพาะอาจารย์ที่ปรึกษาของโครงงานเท่านั้นที่บันทึกคะแนนสรุปของอาจารย์ที่ปรึกษาได้");
  if (project.status !== "REPORT_APPROVED" && project.status !== "ADVISOR_SCORING") {
    throw new Error("คะแนนสรุปของอาจารย์ที่ปรึกษาจะบันทึกได้หลังรายงานฉบับสมบูรณ์ผ่านการตรวจแล้วเท่านั้น");
  }

  const now = new Date();
  const total = totalAdvisorScore(input);
  const shouldMoveToAdvisorScoring = project.status === "REPORT_APPROVED";
  const score = await timer.measure("advisor_score_transaction", () => prisma.$transaction(async (tx) => {
    const saved = await tx.advisorScore.upsert({
      where: { projectId: project.id },
      update: {
        advisorTeacherId: teacher.id,
        score: total,
        responsibilityScore: input.responsibility,
        researchProcessScore: input.researchProcess,
        problemSolvingScore: input.problemSolving,
        communicationScore: input.communication,
        professionalismScore: input.professionalism,
        comment: comment || null,
        status: "SUBMITTED",
        reportClosedAt: project.advisorScore?.reportClosedAt ?? now,
        unlockedAt: project.advisorScore?.unlockedAt ?? now,
        submittedAt: now
      },
      create: {
        projectId: project.id,
        advisorTeacherId: teacher.id,
        score: total,
        responsibilityScore: input.responsibility,
        researchProcessScore: input.researchProcess,
        problemSolvingScore: input.problemSolving,
        communicationScore: input.communication,
        professionalismScore: input.professionalism,
        comment: comment || null,
        status: "SUBMITTED",
        reportClosedAt: now,
        unlockedAt: now,
        submittedAt: now
      }
    });

    if (shouldMoveToAdvisorScoring) {
      await tx.project.update({
        where: { id: project.id },
        data: { status: "ADVISOR_SCORING" }
      });
      await tx.projectStatusHistory.create({
        data: {
          projectId: project.id,
          fromStatus: "REPORT_APPROVED",
          toStatus: "ADVISOR_SCORING",
          reason: "ADVISOR_SCORE_SUBMITTED",
          actorUserId: user.id,
          metadataJson: { advisorScoreId: saved.id, totalScore: total }
        }
      });
    }

    await tx.projectTimelineEvent.create({
      data: {
        projectId: project.id,
        eventType: "ADVISOR_SCORE_SUBMITTED",
        eventTitle: project.advisorScore ? "แก้ไขคะแนนสรุปของอาจารย์ที่ปรึกษา 25%" : "บันทึกคะแนนสรุปของอาจารย์ที่ปรึกษา 25%",
        eventDescription: comment || null,
        actorUserId: user.id,
        relatedEntityType: "AdvisorScore",
        relatedEntityId: saved.id,
        metadataJson: {
          totalScore: total,
          isRevision: Boolean(project.advisorScore),
          previousTotalScore: project.advisorScore?.score == null ? null : Number(project.advisorScore.score)
        }
      }
    });

    return saved;
  }));

  revalidatePath("/teacher/advisor-score");
  revalidatePath("/student/report");
  timer.end("redirect");
  redirectWithQuery("/teacher/advisor-score", {
    success: project.advisorScore ? "advisor_score_updated" : "advisor_score_saved",
    score_id: score.id
  });
}
