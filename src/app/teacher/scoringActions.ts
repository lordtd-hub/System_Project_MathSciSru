"use server";

import { revalidatePath } from "next/cache";
import type { AssessmentRoundType, AttemptType, ProjectStatus, Teacher } from "@prisma/client";
import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { prisma } from "@/lib/db";
import { createActionTimer } from "@/lib/diagnostics/actionTiming";
import { calculateFinalQaCriterionScore, findFinalQaCriterion } from "@/lib/rubrics/finalQaRubric";
import { readActiveAssessmentRubric, readProposalConditionRubric } from "@/lib/rubrics/readProposalConditionRubric";
import { calculateCriterionScore, findProposalQaCriterion } from "@/lib/rubrics/proposalQaRubric";
import { calculateProgressQaCriterionScore, findProgressQaCriterion } from "@/lib/rubrics/progressQaRubric";
import { validateProposalDecision } from "@/lib/scoring/checklistScoring";
import { missingScoreFieldNames } from "@/lib/scoring/formCompleteness";
import { persistPresentationScore } from "@/lib/scoring/persistPresentationScore";
import { persistProposalScore } from "@/lib/scoring/persistProposalScore";
import { classifyExpectedScoreActionError } from "@/lib/scoring/scoreActionErrors";
import { validateProgress1Score, validateProgress2Score, type Progress1ScoreInput } from "@/lib/scoring/progress1Scoring";
import { readOptionalConditionCount } from "@/lib/scoring/proposalDraftIntegrity";
import type { TeacherScoreActionResult } from "@/lib/scoring/teacherScoreActionResult";
import { assertRateLimit, pilotRateLimits } from "@/lib/security/rateLimit";
import { requestSizeLimits, sizeError } from "@/lib/security/requestSize";
import { validateMarkdownInput } from "@/lib/validators/submissionContent";

type StandardRoundConfig = {
  actionName: string;
  roundType: AssessmentRoundType;
  attemptType: AttemptType;
  assessmentKind: "PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENT";
  allowedProjectStatuses: ProjectStatus[];
  eventType: string;
  createEventTitle: string;
  updateEventTitle: string;
  auditAction: string;
  successCode: string;
  revisionCode: string;
  completeFinalWhenReady?: boolean;
};

function unexpectedResult(actionName: string, requestId: string, error: unknown): TeacherScoreActionResult {
  console.error(`[${actionName}] unexpected failure`, {
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError"
  });
  return { status: "unexpected", code: "teacher_score_unexpected", requestId };
}

async function scoringIdentity(actionName: string, requestId: string): Promise<
  | { ok: false; error: TeacherScoreActionResult }
  | { ok: true; userId: string; teacher: Teacher; evaluatorDisplayName: string }
> {
  const user = await auth();
  if (!user?.user.id || !hasApprovedTeacherCapability(user.user)) {
    return { ok: false, error: { status: "conflict", code: "score_evaluator_not_eligible", requestId } };
  }
  assertRateLimit(`teacher:${user.user.id}:${actionName}`, pilotRateLimits.scoring);
  const teacher = await prisma.teacher.findUnique({ where: { userId: user.user.id } });
  if (!teacher) {
    return { ok: false, error: { status: "conflict", code: "score_evaluator_not_eligible", requestId } };
  }
  return {
    ok: true,
    userId: user.user.id,
    teacher,
    evaluatorDisplayName: `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`
  };
}

async function persistStandardScore({
  requestId,
  projectId,
  comment,
  items,
  config,
  rawTotalScore,
  userId,
  teacherId,
  evaluatorDisplayName,
  courseOfferingId
}: {
  requestId: string;
  projectId: string;
  comment: string;
  items: Array<{ id: string; itemKey: string; checked: boolean; pointsAwarded: number; conditionCount?: number }>;
  config: StandardRoundConfig;
  rawTotalScore: number;
  userId: string;
  teacherId: string;
  evaluatorDisplayName: string;
  courseOfferingId: string;
}): Promise<TeacherScoreActionResult> {
  const round = await prisma.assessmentRound.findUnique({
    where: { courseOfferingId_roundType: { courseOfferingId, roundType: config.roundType } },
    select: { id: true }
  });
  if (!round) return { status: "conflict", code: "score_round_missing", requestId };

  const persisted = await persistPresentationScore({
    requestId,
    actorUserId: userId,
    teacherId,
    evaluatorDisplayName,
    projectId,
    assessmentRoundId: round.id,
    roundType: config.roundType,
    attemptType: config.attemptType,
    assessmentKind: config.assessmentKind,
    allowedProjectStatuses: config.allowedProjectStatuses,
    rawTotalScore,
    overallComment: comment || null,
    items,
    eventType: config.eventType,
    createEventTitle: config.createEventTitle,
    updateEventTitle: config.updateEventTitle,
    auditAction: config.auditAction,
    completeFinalWhenReady: config.completeFinalWhenReady
  });
  return {
    status: "success",
    code: persisted.isRevision ? config.revisionCode : config.successCode,
    requestId,
    unchanged: persisted.unchanged
  };
}

async function submitProgressScore(
  formData: FormData,
  config: StandardRoundConfig,
  validateScore: (input: Progress1ScoreInput) => string[]
): Promise<TeacherScoreActionResult> {
  const requestId = crypto.randomUUID();
  const timer = createActionTimer(config.actionName, { requestId });
  try {
    const identity = await scoringIdentity(config.actionName, requestId);
    if (!identity.ok) return identity.error;
    const projectId = String(formData.get("project_id") ?? "");
    const comment = String(formData.get("comment") ?? "").trim();
    if (!projectId) return { status: "validation", code: "score_project_missing", requestId };
    if (sizeError(comment, requestSizeLimits.commentTextBytes, "teacher score comment")) {
      return { status: "validation", code: "teacher_text_too_long", requestId };
    }

    const input: Progress1ScoreInput = {
      progress: Number(formData.get("progress")),
      problemSolving: Number(formData.get("problem_solving")),
      researchResults: Number(formData.get("research_results")),
      presentation: Number(formData.get("presentation")),
      overall: Number(formData.get("overall"))
    };
    const validationErrors = validateScore(input);
    if (comment) validationErrors.push(...validateMarkdownInput(comment, "ข้อเสนอแนะการให้คะแนน"));
    if (validationErrors.length) return { status: "validation", code: "teacher_score_invalid", requestId };

    const [project, rubric] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId }, select: { courseOfferingId: true } }),
      readActiveAssessmentRubric(prisma, config.roundType)
    ]);
    if (!project) return { status: "conflict", code: "score_context_missing", requestId };
    if (!rubric?.items.length) return { status: "conflict", code: "score_rubric_missing", requestId };
    const fieldNames = rubric.items.map((item) => findProgressQaCriterion(item.itemKey)
      ? `condition_count:${item.id}`
      : item.itemKey === "problemSolving"
        ? "problem_solving"
        : item.itemKey === "researchResults"
          ? "research_results"
          : item.itemKey);
    const missingFields = missingScoreFieldNames(formData, fieldNames);
    if (missingFields.length) return { status: "validation", code: "score_rubric_incomplete", requestId, missingFields };

    const valuesByKey: Record<string, number> = {
      progress: input.progress,
      problemSolving: input.problemSolving,
      researchResults: input.researchResults,
      presentation: input.presentation,
      overall: input.overall
    };
    let invalidRubricValue = false;
    const items = rubric.items.map((item) => {
      const criterion = findProgressQaCriterion(item.itemKey);
      if (!criterion) {
        const pointsAwarded = valuesByKey[item.itemKey] ?? 0;
        return { id: item.id, itemKey: item.itemKey, checked: pointsAwarded > 0, pointsAwarded };
      }
      const fieldName = `condition_count:${item.id}`;
      const conditionCount = readOptionalConditionCount(formData, fieldName);
      if (conditionCount === null || conditionCount > criterion.conditions.length) invalidRubricValue = true;
      const safeCount = conditionCount ?? 0;
      const pointsAwarded = calculateProgressQaCriterionScore(criterion, safeCount);
      return { id: item.id, itemKey: item.itemKey, checked: pointsAwarded > 0, pointsAwarded, conditionCount: safeCount };
    });
    if (invalidRubricValue) return { status: "validation", code: "teacher_score_invalid", requestId };

    const result = await timer.measure("atomic_score_transaction", () => persistStandardScore({
      requestId,
      projectId,
      comment,
      items,
      config,
      rawTotalScore: items.reduce((total, item) => total + item.pointsAwarded, 0),
      userId: identity.userId,
      teacherId: identity.teacher.id,
      evaluatorDisplayName: identity.evaluatorDisplayName,
      courseOfferingId: project.courseOfferingId
    }));
    revalidatePath(config.roundType === "PROGRESS_1" ? "/teacher/progress1" : "/teacher/progress2");
    revalidatePath("/teacher");
    revalidatePath("/student");
    timer.end(result.status);
    return result;
  } catch (error) {
    timer.end("error");
    const expected = classifyExpectedScoreActionError(error, requestId);
    if (expected) return expected;
    return unexpectedResult(config.actionName, requestId, error);
  }
}

const progress1Config: StandardRoundConfig = {
  actionName: "teacher.submitProgress1Score",
  roundType: "PROGRESS_1",
  attemptType: "PROGRESS_1",
  assessmentKind: "PROGRESS_1",
  allowedProjectStatuses: ["IN_PROGRESS"],
  eventType: "PROGRESS_1_SCORE_SUBMITTED",
  createEventTitle: "บันทึกคะแนนการสอบความก้าวหน้าครั้งที่ 1",
  updateEventTitle: "แก้ไขคะแนนการสอบความก้าวหน้าครั้งที่ 1",
  auditAction: "PROGRESS_1_SCORE_SAVED",
  successCode: "progress_1_score_saved",
  revisionCode: "progress_1_score_updated"
};

const progress2Config: StandardRoundConfig = {
  actionName: "teacher.submitProgress2Score",
  roundType: "PROGRESS_2",
  attemptType: "PROGRESS_2",
  assessmentKind: "PROGRESS_2",
  allowedProjectStatuses: ["IN_PROGRESS"],
  eventType: "PROGRESS_2_SCORE_SUBMITTED",
  createEventTitle: "บันทึกคะแนนการสอบความก้าวหน้าครั้งที่ 2",
  updateEventTitle: "แก้ไขคะแนนการสอบความก้าวหน้าครั้งที่ 2",
  auditAction: "PROGRESS_2_SCORE_SAVED",
  successCode: "progress_2_score_saved",
  revisionCode: "progress_2_score_updated"
};

export async function submitProgress1Score(
  _previousState: TeacherScoreActionResult,
  formData: FormData
) {
  return submitProgressScore(formData, progress1Config, validateProgress1Score);
}

export async function submitProgress2Score(
  _previousState: TeacherScoreActionResult,
  formData: FormData
) {
  return submitProgressScore(formData, progress2Config, validateProgress2Score);
}

export async function submitFinalPresentationScore(
  _previousState: TeacherScoreActionResult,
  formData: FormData
): Promise<TeacherScoreActionResult> {
  const requestId = crypto.randomUUID();
  const config: StandardRoundConfig = {
    actionName: "teacher.submitFinalPresentationScore",
    roundType: "FINAL_PRESENTATION",
    attemptType: "FINAL_PRESENTATION",
    assessmentKind: "FINAL_PRESENT",
    allowedProjectStatuses: ["IN_PROGRESS", "FINAL_DONE"],
    eventType: "FINAL_PRESENTATION_SCORE_SUBMITTED",
    createEventTitle: "บันทึกคะแนนการสอบนำเสนอขั้นสุดท้าย",
    updateEventTitle: "แก้ไขคะแนนการสอบนำเสนอขั้นสุดท้าย",
    auditAction: "FINAL_PRESENTATION_SCORE_SAVED",
    successCode: "final_score_saved",
    revisionCode: "final_score_updated",
    completeFinalWhenReady: true
  };
  const timer = createActionTimer(config.actionName, { requestId });
  try {
    const identity = await scoringIdentity(config.actionName, requestId);
    if (!identity.ok) return identity.error;
    const projectId = String(formData.get("project_id") ?? "");
    const comment = String(formData.get("comment") ?? "").trim();
    if (!projectId) return { status: "validation", code: "score_project_missing", requestId };
    if (sizeError(comment, requestSizeLimits.commentTextBytes, "teacher score comment")) {
      return { status: "validation", code: "teacher_text_too_long", requestId };
    }
    if (comment && validateMarkdownInput(comment, "ข้อเสนอแนะการให้คะแนน").length) {
      return { status: "validation", code: "teacher_markdown_invalid", requestId };
    }

    const [project, rubric] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId }, select: { courseOfferingId: true } }),
      readActiveAssessmentRubric(prisma, "FINAL_PRESENTATION")
    ]);
    if (!project) return { status: "conflict", code: "score_context_missing", requestId };
    if (!rubric?.items.length) return { status: "conflict", code: "score_rubric_missing", requestId };
    const fieldNames = rubric.items.map((item) => `condition_count:${item.itemKey}`);
    const missingFields = missingScoreFieldNames(formData, fieldNames);
    if (missingFields.length) return { status: "validation", code: "score_rubric_incomplete", requestId, missingFields };

    let invalidRubricValue = false;
    const items = rubric.items.map((item) => {
      const criterion = findFinalQaCriterion(item.itemKey);
      if (!criterion) {
        invalidRubricValue = true;
        return { id: item.id, itemKey: item.itemKey, checked: false, pointsAwarded: 0 };
      }
      const fieldName = `condition_count:${item.itemKey}`;
      const conditionCount = readOptionalConditionCount(formData, fieldName);
      if (conditionCount === null || conditionCount > criterion.conditions.length) invalidRubricValue = true;
      const safeCount = conditionCount ?? 0;
      const pointsAwarded = calculateFinalQaCriterionScore(criterion, safeCount);
      return { id: item.id, itemKey: item.itemKey, checked: pointsAwarded > 0, pointsAwarded, conditionCount: safeCount };
    });
    if (invalidRubricValue) return { status: "validation", code: "teacher_score_invalid", requestId };

    const result = await timer.measure("atomic_score_transaction", () => persistStandardScore({
      requestId,
      projectId,
      comment,
      items,
      config,
      rawTotalScore: items.reduce((total, item) => total + item.pointsAwarded, 0),
      userId: identity.userId,
      teacherId: identity.teacher.id,
      evaluatorDisplayName: identity.evaluatorDisplayName,
      courseOfferingId: project.courseOfferingId
    }));
    revalidatePath("/teacher/final");
    revalidatePath("/teacher");
    revalidatePath("/student");
    revalidatePath("/student/report");
    timer.end(result.status);
    return result;
  } catch (error) {
    timer.end("error");
    const expected = classifyExpectedScoreActionError(error, requestId);
    if (expected) return expected;
    return unexpectedResult(config.actionName, requestId, error);
  }
}

export async function submitProposalScore(
  _previousState: TeacherScoreActionResult,
  formData: FormData
): Promise<TeacherScoreActionResult> {
  const requestId = crypto.randomUUID();
  const actionName = "teacher.submitProposalScore";
  const timer = createActionTimer(actionName, { requestId });
  try {
    const identity = await scoringIdentity(actionName, requestId);
    if (!identity.ok) return identity.error;
    const assignmentId = String(formData.get("assignment_id") ?? "");
    const submitMode = String(formData.get("submit_mode") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    const overallComment = String(formData.get("overall_comment") ?? "").trim();
    const rawDecision = String(formData.get("decision") ?? "");
    const decision = ["PASS", "PASS_WITH_REVISION", "NOT_PASS"].includes(rawDecision)
      ? rawDecision as "PASS" | "PASS_WITH_REVISION" | "NOT_PASS"
      : null;
    if (!assignmentId || (submitMode !== "draft" && submitMode !== "submit")) {
      return { status: "validation", code: "proposal_decision_invalid", requestId };
    }
    if (
      sizeError(reason, requestSizeLimits.shortReasonBytes, "proposal decision reason")
      || sizeError(overallComment, requestSizeLimits.commentTextBytes, "proposal feedback")
    ) return { status: "validation", code: "teacher_text_too_long", requestId };

    const [assignment, rubric] = await Promise.all([
      prisma.evaluatorAssignment.findUnique({
        where: { id: assignmentId },
        include: { scoreSubmission: { select: { status: true } } }
      }),
      readProposalConditionRubric(prisma)
    ]);
    if (!assignment) return { status: "conflict", code: "score_context_missing", requestId };
    if (assignment.evaluatorUserId !== identity.userId) {
      return { status: "conflict", code: "score_evaluator_not_eligible", requestId };
    }
    if (!rubric?.items.length) return { status: "conflict", code: "proposal_rubric_missing", requestId };

    const isRevision = assignment.status === "SUBMITTED" || assignment.scoreSubmission?.status === "SUBMITTED";
    const isSubmitting = submitMode === "submit" || isRevision;
    const conditionFields = rubric.items
      .filter((item) => Boolean(findProposalQaCriterion(item.itemKey)))
      .map((item) => `condition_count:${item.id}`);
    const missingFields = missingScoreFieldNames(formData, conditionFields);
    if (isSubmitting && missingFields.length) {
      return { status: "validation", code: "score_rubric_incomplete", requestId, missingFields };
    }
    if (isSubmitting && !decision) return { status: "validation", code: "proposal_decision_invalid", requestId };
    if (isSubmitting && validateProposalDecision(decision!, reason).length) {
      return { status: "validation", code: "proposal_decision_reason_required", requestId };
    }
    if (isSubmitting && !overallComment) return { status: "validation", code: "proposal_feedback_required", requestId };

    const checkedIds = new Set(formData.getAll("checked_item").map(String));
    let invalidRubricValue = false;
    const items = rubric.items.flatMap((item) => {
      const criterion = findProposalQaCriterion(item.itemKey);
      if (!criterion) {
        if (!isSubmitting && !checkedIds.has(item.id)) return [];
        const checked = checkedIds.has(item.id);
        return [{
          id: item.id,
          itemKey: item.itemKey,
          checked,
          pointsAwarded: checked ? item.points : 0,
          isCritical: item.isCritical,
          itemLabelTh: item.itemLabelTh
        }];
      }
      const fieldName = `condition_count:${item.id}`;
      const rawValue = formData.get(fieldName);
      const conditionCount = readOptionalConditionCount(formData, fieldName);
      const conditionMax = criterion.conditions.length || criterion.requiredSections?.length || 0;
      if (conditionCount === null) {
        if (typeof rawValue === "string" && rawValue.trim()) invalidRubricValue = true;
        return [];
      }
      if (conditionCount > conditionMax) invalidRubricValue = true;
      const pointsAwarded = calculateCriterionScore(criterion, conditionCount);
      return [{
        id: item.id,
        itemKey: item.itemKey,
        checked: pointsAwarded > 0,
        pointsAwarded,
        conditionCount,
        isCritical: item.isCritical,
        itemLabelTh: item.itemLabelTh
      }];
    });
    if (invalidRubricValue) return { status: "validation", code: "teacher_score_invalid", requestId };

    const persisted = await timer.measure("atomic_score_transaction", () => persistProposalScore({
      requestId,
      actorUserId: identity.userId,
      assignmentId,
      submit: isSubmitting,
      decision,
      reason,
      overallComment,
      rawTotalScore: items.reduce((total, item) => total + item.pointsAwarded, 0),
      items
    }));
    revalidatePath(`/teacher/scoring/${assignmentId}`);
    if (isSubmitting) {
      revalidatePath("/teacher");
      revalidatePath("/teacher/proposals");
      revalidatePath("/student/proposal");
      revalidatePath("/admin");
      revalidatePath("/admin/proposals");
    }
    timer.end("success");
    return {
      status: "success",
      code: isSubmitting ? (persisted.isRevision ? "proposal_score_updated" : "proposal_score_submitted") : "proposal_score_draft_saved",
      requestId,
      unchanged: persisted.unchanged
    };
  } catch (error) {
    timer.end("error");
    const expected = classifyExpectedScoreActionError(error, requestId);
    if (expected) return expected;
    return unexpectedResult(actionName, requestId, error);
  }
}
