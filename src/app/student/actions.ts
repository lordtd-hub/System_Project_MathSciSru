"use server";

import type { AttemptType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isRoundOpen } from "@/lib/assessments/courseRounds";
import { isPresentationAssessmentComplete } from "@/lib/assessments/presentationCompletion";
import { getProgress1Readiness } from "@/lib/assessments/roundEligibility";
import { hasOpenLateRoundException, requiresLateRoundPenalty } from "@/lib/assessments/roundExceptions";
import { isSchedulableRoundType, parseScheduleDateTime, roundTypeToAssessmentKind } from "@/lib/scheduling/scheduleRules";
import { validateMaterialLink } from "@/lib/validators/materialLink";
import { validateMarkdownInput } from "@/lib/validators/submissionContent";
import { canStudentSubmitFinalReport } from "@/lib/reports/reportWorkflow";
import { assertRateLimit, pilotRateLimits } from "@/lib/security/rateLimit";
import { requestSizeLimits, sizeError } from "@/lib/security/requestSize";
import { parseSelectableSourceType } from "@/lib/projects/sourceType";
import {
  runStudentAction,
  studentActionSuccess,
  StudentActionValidationError,
  type StudentActionResult
} from "@/lib/projects/studentActionResult";
import {
  saveProjectOriginAtomic,
  saveProposalSubmissionAtomic,
  saveStudentProfileAtomic,
  type ProposalTimelineItem,
  type StudentMutationContext
} from "@/lib/projects/studentCurrentStageMutations";
import { redirectWithQuery } from "@/lib/navigation/redirectWithQuery";
import { notifyAdvisorRequestSubmitted, notifyExamScheduleProposed } from "@/lib/notifications/workflowEmail";

async function requireStudentContext() {
  const session = await auth();
  if (session?.user.role !== "STUDENT" || !session.user.id || !session.user.email) {
    throw new Error("หน้านี้สำหรับนักศึกษาเท่านั้น");
  }
  const student = await prisma.student.findUniqueOrThrow({
    where: { generatedEmail: session.user.email.toLowerCase() }
  });
  const project = await prisma.project.findFirstOrThrow({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" }
  });
  return { userId: session.user.id, student, project };
}

type StudentFormPath = "/student/project" | "/student/proposal" | "/student/schedule" | "/student/report";

function requiredText(formData: FormData, key: string, label: string, path: StudentFormPath): string {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) redirectWithQuery(path, { error: "student_required_field_missing" });
  return value;
}

function ensureStudentTextSize(value: string, maxBytes: number, label: string, path: StudentFormPath) {
  if (sizeError(value, maxBytes, label)) redirectWithQuery(path, { error: "student_text_too_long" });
}

function ensureStudentMarkdown(errors: string[], path: StudentFormPath) {
  if (errors.length) redirectWithQuery(path, { error: "student_markdown_invalid" });
}

async function hasCompletedPresentationScores(projectId: string, attemptType: Extract<AttemptType, "PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENTATION">) {
  const project = await prisma.project.findUnique({
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

async function assertPreviousPresentationRoundComplete(projectId: string, roundType: string) {
  if (roundType === "PROGRESS_2" && !(await hasCompletedPresentationScores(projectId, "PROGRESS_1"))) {
    redirectWithQuery("/student/schedule", { error: "schedule_previous_round_incomplete" });
  }
  if (roundType === "FINAL_PRESENTATION") {
    const [progress1Complete, progress2Complete] = await Promise.all([
      hasCompletedPresentationScores(projectId, "PROGRESS_1"),
      hasCompletedPresentationScores(projectId, "PROGRESS_2")
    ]);
    if (!progress1Complete || !progress2Complete) {
      redirectWithQuery("/student/schedule", { error: "schedule_previous_round_incomplete" });
    }
  }
}

function mutationContext(userId: string, student: {
  id: string;
  studentCode: string;
  firstNameTh: string;
  lastNameTh: string;
}, projectId: string): StudentMutationContext {
  return {
    userId,
    studentId: student.id,
    projectId,
    studentCode: student.studentCode,
    studentFirstNameTh: student.firstNameTh,
    studentLastNameTh: student.lastNameTh
  };
}

function typedRequiredText(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    throw new StudentActionValidationError("REQUIRED_FIELD_MISSING", `กรุณากรอก${label}ให้ครบถ้วน`, [key]);
  }
  return value;
}

function typedDeclaration(formData: FormData) {
  if (formData.get("student_declaration") !== "on") {
    throw new StudentActionValidationError(
      "STUDENT_DECLARATION_MISSING",
      "กรุณายืนยันคำรับรองของนักศึกษาก่อนส่งข้อมูล",
      ["student_declaration"]
    );
  }
}

function typedTextSize(value: string, maxBytes: number, label: string, field: string) {
  const error = sizeError(value, maxBytes, label);
  if (error) throw new StudentActionValidationError("TEXT_TOO_LONG", error, [field]);
}

function typedMarkdown(value: string, label: string, field: string) {
  const errors = validateMarkdownInput(value, label);
  if (errors.length) throw new StudentActionValidationError("MARKDOWN_INVALID", errors[0], [field]);
}

function parseTypedProposalTimeline(value: FormDataEntryValue | null): ProposalTimelineItem[] {
  if (typeof value !== "string" || !value.trim()) return [];
  let parsed: Array<Partial<ProposalTimelineItem>>;
  try {
    parsed = JSON.parse(value) as Array<Partial<ProposalTimelineItem>>;
  } catch {
    throw new StudentActionValidationError("TIMELINE_INVALID", "ข้อมูลแผนดำเนินงานไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่", ["timeline"]);
  }
  return parsed.map((item) => {
    const startWeek = Number(item.startWeek);
    const endWeek = Number(item.endWeek);
    if (!Number.isInteger(startWeek) || !Number.isInteger(endWeek) || startWeek < 1 || startWeek > 16 || endWeek < startWeek || endWeek > 16) {
      throw new StudentActionValidationError("TIMELINE_INVALID", "สัปดาห์ในแผนดำเนินงานต้องอยู่ระหว่าง 1-16 และเรียงตามลำดับ", ["timeline"]);
    }
    return {
      activity: String(item.activity ?? "").trim(),
      startWeek,
      endWeek,
      deliverable: String(item.deliverable ?? "").trim()
    };
  }).filter((item) => item.activity || item.deliverable);
}

export async function saveStudentProfile(
  _previousState: StudentActionResult,
  formData: FormData
): Promise<StudentActionResult> {
  return runStudentAction("saveStudentProfile", async (requestId) => {
    const { userId, student, project } = await requireStudentContext();
    const outcome = await saveStudentProfileAtomic(
      prisma,
      mutationContext(userId, student, project.id),
      {
        preferredName: String(formData.get("preferred_name") ?? "").trim() || null,
        phone: String(formData.get("phone") ?? "").trim() || null,
        lineId: String(formData.get("line_id") ?? "").trim() || null
      }
    );
    revalidatePath("/student");
    revalidatePath("/student/profile");
    return studentActionSuccess(
      requestId,
      "STUDENT_PROFILE_SAVED",
      outcome.unchanged ? "ข้อมูลนี้ถูกบันทึกไว้เรียบร้อยแล้ว" : "บันทึกข้อมูลนักศึกษาเรียบร้อยแล้ว",
      outcome.unchanged
    );
  });
}

export async function saveProjectOrigin(
  _previousState: StudentActionResult,
  formData: FormData
): Promise<StudentActionResult> {
  return runStudentAction("saveProjectOrigin", async (requestId) => {
    const { userId, student, project } = await requireStudentContext();
    assertRateLimit(`student:${userId}:saveProjectOrigin`, pilotRateLimits.workflowMutation);
    const materialLink = typedRequiredText(formData, "material_link", "ลิงก์เอกสารประกอบ");
    const linkResult = validateMaterialLink(materialLink);
    if (!linkResult.ok) {
      throw new StudentActionValidationError(
        "MATERIAL_LINK_INVALID",
        "อนุญาตเฉพาะลิงก์ https จาก Google Drive, Google Docs หรือ Google Classroom เท่านั้น",
        ["material_link"]
      );
    }
    typedDeclaration(formData);
    let sourceType;
    try {
      sourceType = parseSelectableSourceType(formData.get("source_type"));
    } catch {
      throw new StudentActionValidationError("SOURCE_TYPE_INVALID", "กรุณาเลือกแหล่งที่มาของหัวข้อให้ถูกต้อง", ["source_type"]);
    }
    const tentativeAdvisorId = String(formData.get("tentative_advisor_id") ?? "").trim();
    if (!tentativeAdvisorId) {
      throw new StudentActionValidationError("STUDENT_ADVISOR_REQUIRED", "กรุณาเลือกอาจารย์ที่ปรึกษาก่อนส่งคำขอ", ["tentative_advisor_id"]);
    }
    const input = {
      initialProjectTitleTh: typedRequiredText(formData, "initial_project_title_th", "ชื่อหัวข้อภาษาไทย"),
      initialProjectTitleEn: String(formData.get("initial_project_title_en") ?? "").trim() || null,
      sourceType,
      reasonForTopic: typedRequiredText(formData, "reason_for_topic", "เหตุผลที่เลือกหัวข้อ"),
      expectedMathArea: typedRequiredText(formData, "expected_math_area", "ขอบเขตคณิตศาสตร์ที่เกี่ยวข้อง"),
      tentativeAdvisorId,
      consultationSummary: typedRequiredText(formData, "consultation_summary", "สรุปการปรึกษา"),
      initialReferences: typedRequiredText(formData, "initial_references", "เอกสารอ้างอิงเบื้องต้น"),
      materialLink: linkResult.normalizedUrl,
      declarationAccepted: true as const
    };
    typedTextSize(input.reasonForTopic, requestSizeLimits.markdownTextBytes, "เหตุผลที่เลือกหัวข้อ", "reason_for_topic");
    typedTextSize(input.expectedMathArea, requestSizeLimits.markdownTextBytes, "ขอบเขตคณิตศาสตร์ที่เกี่ยวข้อง", "expected_math_area");
    typedTextSize(input.consultationSummary, requestSizeLimits.commentTextBytes, "สรุปการปรึกษา", "consultation_summary");
    typedTextSize(input.initialReferences, requestSizeLimits.markdownTextBytes, "เอกสารอ้างอิงเบื้องต้น", "initial_references");

    const outcome = await saveProjectOriginAtomic(prisma, mutationContext(userId, student, project.id), input);
    if (!outcome.unchanged && outcome.advisorExternalNotification) {
      const notification = outcome.advisorExternalNotification;
      after(async () => {
        const startedAt = performance.now();
        try {
          await notifyAdvisorRequestSubmitted(notification.projectId, notification.advisorTeacherId, { persistInApp: false });
        } catch (error) {
          console.error(JSON.stringify({
            type: "student_action_after_failed",
            action: "saveProjectOrigin",
            requestId,
            durationMs: Math.round(performance.now() - startedAt),
            errorName: error instanceof Error ? error.name : "UnknownError"
          }));
        }
      });
    }
    revalidatePath("/student");
    revalidatePath("/student/origin");
    revalidatePath("/student/project");
    return studentActionSuccess(
      requestId,
      "PROJECT_ORIGIN_SAVED",
      outcome.unchanged ? "ข้อมูลคำขอนี้ถูกบันทึกไว้เรียบร้อยแล้ว" : "ส่งคำขอให้อาจารย์ที่ปรึกษาเรียบร้อยแล้ว",
      outcome.unchanged
    );
  });
}

export async function saveProposalSubmission(
  _previousState: StudentActionResult,
  formData: FormData
): Promise<StudentActionResult> {
  return runStudentAction("saveProposalSubmission", async (requestId) => {
    const { userId, student, project } = await requireStudentContext();
    assertRateLimit(`student:${userId}:saveProposalSubmission`, pilotRateLimits.workflowMutation);
    const materialLink = typedRequiredText(formData, "material_link", "ลิงก์เอกสารประกอบ");
    const linkResult = validateMaterialLink(materialLink);
    if (!linkResult.ok) {
      throw new StudentActionValidationError(
        "MATERIAL_LINK_INVALID",
        "อนุญาตเฉพาะลิงก์ https จาก Google Drive, Google Docs หรือ Google Classroom เท่านั้น",
        ["material_link"]
      );
    }
    typedDeclaration(formData);
    const abstractText = typedRequiredText(formData, "abstract_of_talk", "บทคัดย่อการนำเสนอ");
    const content = {
      motivationBackground: typedRequiredText(formData, "motivation_background", "ที่มาและความสำคัญ"),
      objectives: typedRequiredText(formData, "objectives", "วัตถุประสงค์"),
      proposedMethods: typedRequiredText(formData, "proposed_methods", "วิธีดำเนินงาน"),
      expectedOutcomes: typedRequiredText(formData, "expected_outcomes", "ผลที่คาดว่าจะได้รับ"),
      timeline: typedRequiredText(formData, "timeline", "แผนดำเนินงาน"),
      timelineItems: parseTypedProposalTimeline(formData.get("timeline_items_json")),
      questionsForTeachers: String(formData.get("questions_for_teachers") ?? "").trim()
    };
    typedTextSize(content.questionsForTeachers, requestSizeLimits.commentTextBytes, "คำถามสำหรับอาจารย์", "questions_for_teachers");
    typedMarkdown(abstractText, "บทคัดย่อการนำเสนอ", "abstract_of_talk");
    typedMarkdown(content.motivationBackground, "ที่มาและความสำคัญ", "motivation_background");
    typedMarkdown(content.objectives, "วัตถุประสงค์", "objectives");
    typedMarkdown(content.proposedMethods, "วิธีดำเนินงาน", "proposed_methods");
    typedMarkdown(content.expectedOutcomes, "ผลที่คาดว่าจะได้รับ", "expected_outcomes");
    typedMarkdown(content.timeline, "แผนดำเนินงาน", "timeline");

    const outcome = await saveProposalSubmissionAtomic(
      prisma,
      mutationContext(userId, student, project.id),
      {
        titleTh: typedRequiredText(formData, "project_title_th", "ชื่อ Proposal ภาษาไทย"),
        titleEn: String(formData.get("project_title_en") ?? "").trim() || null,
        abstractText,
        content,
        materialLink: linkResult.normalizedUrl,
        declarationAccepted: true
      }
    );
    revalidatePath("/student");
    revalidatePath("/student/proposal");
    return studentActionSuccess(
      requestId,
      "PROPOSAL_SUBMISSION_SAVED",
      outcome.unchanged ? "เอกสาร Proposal ชุดนี้ถูกบันทึกไว้เรียบร้อยแล้ว" : "ส่งเอกสาร Proposal เรียบร้อยแล้ว",
      outcome.unchanged
    );
  });
}

export async function saveAssessmentEvidence(formData: FormData) {
  const { userId, student, project } = await requireStudentContext();
  assertRateLimit(`student:${userId}:saveAssessmentEvidence`, pilotRateLimits.workflowMutation);
  const kind = String(formData.get("assessment_kind") ?? "");
  const roundType = kind === "FINAL_PRESENT" ? "FINAL_PRESENTATION" : kind;
  if (!["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENT"].includes(kind) || !isSchedulableRoundType(roundType)) {
    redirectWithQuery("/student/schedule", { error: "schedule_round_invalid" });
  }
  if (project.status !== "IN_PROGRESS") redirectWithQuery("/student/schedule", { error: "schedule_not_available" });

  const round = await prisma.assessmentRound.findUnique({
    where: {
      courseOfferingId_roundType: {
        courseOfferingId: project.courseOfferingId,
        roundType
      }
    }
  });
  if (!round) redirectWithQuery("/student/schedule", { error: "schedule_round_not_open" });
  const lateRoundExceptions = await prisma.projectRoundException.findMany({
    where: { projectId: project.id, assessmentRoundId: round.id, status: "OPEN" },
    select: { exceptionType: true, status: true }
  });
  const hasLateOverride = hasOpenLateRoundException(lateRoundExceptions);
  if (!isRoundOpen(round.status) && !hasLateOverride) redirectWithQuery("/student/schedule", { error: "schedule_round_not_open" });
  await assertPreviousPresentationRoundComplete(project.id, roundType);

  if (roundType === "PROGRESS_1") {
    const fullProject = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      include: {
        proposalResults: { orderBy: { decidedAt: "desc" }, take: 1 },
        committeeAssignments: true,
        roundExceptions: { where: { assessmentRoundId: round.id, status: { not: "RESOLVED" } } }
      }
    });
    const readiness = getProgress1Readiness(fullProject);
    if (!readiness.eligible) redirectWithQuery("/student/schedule", { error: "progress_1_project_not_ready" });
  }

  const lockedSchedule = await prisma.examScheduleProposal.findFirst({
    where: {
      projectId: project.id,
      assessmentRoundId: round.id,
      status: { in: ["PROPOSED", "CONFIRMED"] }
    },
    select: { id: true }
  });
  if (lockedSchedule) redirectWithQuery("/student/schedule", { error: "assessment_evidence_locked" });

  const materialLink = requiredText(formData, "material_link", "ลิงก์เอกสารประกอบการสอบ", "/student/schedule");
  const linkResult = validateMaterialLink(materialLink);
  if (!linkResult.ok) redirectWithQuery("/student/schedule", { error: "material_link_invalid" });
  const title = String(formData.get("submission_title") ?? "").trim() || null;
  const content = kind === "FINAL_PRESENT"
    ? {
        finalObjectivesEvidence: requiredText(formData, "final_objectives_evidence", "วัตถุประสงค์ที่ทำสำเร็จและหลักฐาน", "/student/schedule"),
        finalMethodsResults: requiredText(formData, "final_methods_results", "วิธีการ ผลลัพธ์ และการวิเคราะห์", "/student/schedule"),
        finalTimelineAdaptation: requiredText(formData, "final_timeline_adaptation", "การดำเนินงานเทียบแผนและการปรับแผน", "/student/schedule"),
        finalReportReadiness: requiredText(formData, "final_report_readiness", "รายงาน บทความ และประเด็นตอบคำถาม", "/student/schedule")
      }
    : {
        progressPlanTasks: requiredText(formData, "progress_plan_tasks", "งานตามแผน 16 สัปดาห์ที่รายงานในรอบนี้", "/student/schedule"),
        progressEvidence: requiredText(formData, "progress_evidence", "หลักฐาน/ชิ้นงานที่รองรับความก้าวหน้า", "/student/schedule"),
        progressStatus: requiredText(formData, "progress_status", "สถานะงาน", "/student/schedule"),
        progressChallengesNext: requiredText(formData, "progress_challenges_next", "ปัญหา วิธีแก้ และขั้นตอนถัดไป", "/student/schedule")
      };
  const summary = kind === "FINAL_PRESENT"
    ? [content.finalObjectivesEvidence, content.finalMethodsResults, content.finalTimelineAdaptation, content.finalReportReadiness].join("\n\n")
    : [content.progressPlanTasks, content.progressEvidence, content.progressStatus, content.progressChallengesNext].join("\n\n");
  for (const [field, value] of Object.entries(content)) {
    ensureStudentTextSize(value, requestSizeLimits.markdownTextBytes, field, "/student/schedule");
  }
  const markdownErrors = Object.entries(content).flatMap(([field, value]) => validateMarkdownInput(value, field));
  ensureStudentMarkdown(markdownErrors, "/student/schedule");

  const existing = await prisma.assessmentSubmission.findFirst({
    where: { projectId: project.id, kind: kind as "PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENT" },
    orderBy: { submittedAt: "desc" }
  });
  const data = {
    studentId: student.id,
    kind: kind as "PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENT",
    title,
    materialLink: linkResult.normalizedUrl,
    contentJson: { ...content, summary },
    submittedAt: new Date()
  };
  const submission = existing
    ? await prisma.assessmentSubmission.update({ where: { id: existing.id }, data })
    : await prisma.assessmentSubmission.create({ data: { ...data, projectId: project.id } });

  await prisma.projectTimelineEvent.create({
    data: {
      projectId: project.id,
      eventType: "ASSESSMENT_EVIDENCE_SAVED",
      eventTitle: `บันทึกเอกสาร ${roundType}`,
      eventDescription: summary,
      actorUserId: userId,
      relatedEntityType: "AssessmentSubmission",
      relatedEntityId: submission.id,
      metadataJson: {
        kind,
        roundType,
        materialLink: linkResult.normalizedUrl,
        lateRoundOverride: hasLateOverride,
        latePenaltyRequired: requiresLateRoundPenalty(lateRoundExceptions),
        latePenaltyPercent: requiresLateRoundPenalty(lateRoundExceptions) ? 10 : 0
      }
    }
  });
  revalidatePath("/student");
  revalidatePath("/student/schedule");
  revalidatePath("/teacher/schedules");
  redirectWithQuery("/student/schedule", {
    success: "assessment_evidence_saved",
    assessment_kind: kind,
    submission_id: submission.id
  });
}

export async function submitExamSchedule(formData: FormData) {
  const { userId, student, project } = await requireStudentContext();
  assertRateLimit(`student:${userId}:submitExamSchedule`, pilotRateLimits.workflowMutation);
  const roundType = String(formData.get("round_type") ?? "");
  if (!isSchedulableRoundType(roundType)) redirectWithQuery("/student/schedule", { error: "schedule_round_invalid" });
  if (project.status !== "IN_PROGRESS") redirectWithQuery("/student/schedule", { error: "schedule_not_available" });

  const round = await prisma.assessmentRound.findUnique({
    where: {
      courseOfferingId_roundType: {
        courseOfferingId: project.courseOfferingId,
        roundType
      }
    }
  });
  if (!round) redirectWithQuery("/student/schedule", { error: "schedule_round_not_open" });
  const lateRoundExceptions = await prisma.projectRoundException.findMany({
    where: { projectId: project.id, assessmentRoundId: round.id, status: "OPEN" },
    select: { exceptionType: true, status: true }
  });
  const hasLateOverride = hasOpenLateRoundException(lateRoundExceptions);
  if (!isRoundOpen(round.status) && !hasLateOverride) redirectWithQuery("/student/schedule", { error: "schedule_round_not_open" });
  await assertPreviousPresentationRoundComplete(project.id, roundType);
  const assessmentKind = roundTypeToAssessmentKind(roundType);
  const evidence = await prisma.assessmentSubmission.findFirst({
    where: { projectId: project.id, kind: assessmentKind },
    orderBy: { submittedAt: "desc" },
    select: { id: true }
  });
  if (!evidence) redirectWithQuery("/student/schedule", { error: "assessment_evidence_required" });

  if (roundType === "PROGRESS_1") {
    const fullProject = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      include: {
        proposalResults: { orderBy: { decidedAt: "desc" }, take: 1 },
        committeeAssignments: true,
        roundExceptions: { where: { assessmentRoundId: round.id, status: { not: "RESOLVED" } } }
      }
    });
    const readiness = getProgress1Readiness(fullProject);
    if (!readiness.eligible) redirectWithQuery("/student/schedule", { error: "progress_1_project_not_ready" });
  }

  let parsedSchedule: ReturnType<typeof parseScheduleDateTime>;
  try {
    parsedSchedule = parseScheduleDateTime(
      String(formData.get("schedule_date") ?? ""),
      String(formData.get("start_time") ?? ""),
      String(formData.get("end_time") ?? "")
    );
  } catch {
    redirectWithQuery("/student/schedule", { error: "schedule_time_invalid" });
  }
  const { start, end } = parsedSchedule;
  const room = String(formData.get("room") ?? "").trim() || null;
  const note = String(formData.get("schedule_note") ?? "").trim() || null;
  ensureStudentTextSize(note ?? "", requestSizeLimits.commentTextBytes, "หมายเหตุการนัดสอบ", "/student/schedule");
  if (note) {
    const noteErrors = validateMarkdownInput(note, "หมายเหตุการนัดสอบ");
    ensureStudentMarkdown(noteErrors, "/student/schedule");
  }

  const existing = await prisma.examScheduleProposal.findFirst({
    where: { projectId: project.id, assessmentRoundId: round.id }
  });
  if (existing?.status === "PROPOSED" || existing?.status === "CONFIRMED") {
    redirectWithQuery("/student/schedule", { error: "schedule_request_locked" });
  }
  const scheduleData = {
    courseOfferingId: project.courseOfferingId,
    assessmentRoundId: round.id,
    roundType,
    assessmentKind,
    proposedStartAt: start,
    proposedEndAt: end,
    room,
    note,
    status: "PROPOSED" as const,
    proposedByStudentId: student.id
  };

  const schedule = existing
    ? await prisma.examScheduleProposal.update({ where: { id: existing.id }, data: scheduleData })
    : await prisma.examScheduleProposal.create({ data: { ...scheduleData, projectId: project.id } });

  const committee = await prisma.committeeAssignment.findMany({
    where: { projectId: project.id, active: true, role: { in: ["ADVISOR", "HEAD", "MEMBER"] } },
    select: { teacherId: true }
  });
  const advisors = await prisma.advisorRequest.findMany({
    where: { projectId: project.id, status: "APPROVED" },
    select: { advisorTeacherId: true }
  });
  const requiredApproverIds = [
    ...new Set([...committee.map((assignment) => assignment.teacherId), ...advisors.map((request) => request.advisorTeacherId)])
  ];
  await Promise.all(
    requiredApproverIds.map((teacherId) =>
      prisma.examScheduleApproval.upsert({
        where: { scheduleProposalId_teacherId: { scheduleProposalId: schedule.id, teacherId } },
        update: { decision: "PENDING", comment: null, decidedAt: null },
        create: { scheduleProposalId: schedule.id, teacherId }
      })
    )
  );

  await prisma.projectTimelineEvent.create({
    data: {
      projectId: project.id,
      eventType: "EXAM_SCHEDULE_PROPOSED",
      eventTitle: `เสนอวันสอบ ${roundType}`,
      eventDescription: note,
      actorUserId: userId,
      relatedEntityType: "ExamScheduleProposal",
      relatedEntityId: schedule.id,
      metadataJson: {
        roundType,
        assessmentSubmissionId: evidence.id,
        proposedStartAt: start.toISOString(),
        room,
        lateRoundOverride: hasLateOverride,
        latePenaltyRequired: requiresLateRoundPenalty(lateRoundExceptions),
        latePenaltyPercent: requiresLateRoundPenalty(lateRoundExceptions) ? 10 : 0
      }
    }
  });
  await notifyExamScheduleProposed({
    projectId: project.id,
    scheduleId: schedule.id,
    teacherIds: requiredApproverIds,
    roundType,
    start,
    end,
    room
  }).catch((error) => {
    console.error("schedule notification failed", error);
  });

  revalidatePath("/student");
  revalidatePath("/student/schedule");
  redirectWithQuery("/student/schedule", {
    success: "schedule_saved",
    round_type: roundType,
    schedule_id: schedule.id
  });
}

export async function submitReportVersion(formData: FormData) {
  const { userId, student, project } = await requireStudentContext();
  assertRateLimit(`student:${userId}:submitReportVersion`, pilotRateLimits.workflowMutation);
  const latestReport = await prisma.reportVersion.findFirst({
    where: { projectId: project.id },
    include: { reviews: true },
    orderBy: { versionNo: "desc" }
  });
  const finalPresentationCompleted =
    project.status === "IN_PROGRESS"
      ? await hasCompletedPresentationScores(project.id, "FINAL_PRESENTATION")
      : false;
  const latestReportHasRevisionRequest = Boolean(latestReport?.reviews.some((review) => review.decision === "FAIL"));
  if (!canStudentSubmitFinalReport({
    projectStatus: project.status,
    latestReportHasRevisionRequest,
    finalPresentationCompleted
  })) redirectWithQuery("/student/report", { error: "report_not_available" });

  const reportLink = requiredText(formData, "report_drive_link", "ลิงก์เล่มรายงาน", "/student/report");
  const linkResult = validateMaterialLink(reportLink);
  if (!linkResult.ok) redirectWithQuery("/student/report", { error: "material_link_invalid" });
  const note = String(formData.get("report_note") ?? "").trim();
  ensureStudentTextSize(note, requestSizeLimits.commentTextBytes, "report note", "/student/report");
  if (note) {
    const noteErrors = validateMarkdownInput(note, "report note");
    ensureStudentMarkdown(noteErrors, "/student/report");
  }

  const maxVersion = await prisma.reportVersion.aggregate({
    where: { projectId: project.id },
    _max: { versionNo: true }
  });
  const versionNo = (maxVersion._max.versionNo ?? 0) + 1;
  const shouldMoveToReview = project.status === "FINAL_DONE" || finalPresentationCompleted;

  await prisma.$transaction(async (tx) => {
    const reportVersion = await tx.reportVersion.create({
      data: {
        projectId: project.id,
        versionNo,
        driveLink: linkResult.normalizedUrl,
        submittedByStudentId: student.id
      }
    });

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
          actorUserId: userId,
          metadataJson: { reportVersionId: reportVersion.id, versionNo }
        }
      });
    }

    await tx.projectTimelineEvent.create({
      data: {
        projectId: project.id,
        eventType: "REPORT_VERSION_SUBMITTED",
        eventTitle: `ส่งเล่มรายงานฉบับที่ ${versionNo}`,
        eventDescription: note || null,
        actorUserId: userId,
        relatedEntityType: "ReportVersion",
        relatedEntityId: reportVersion.id,
        metadataJson: { versionNo, driveLink: linkResult.normalizedUrl }
      }
    });
  });

  revalidatePath("/student");
  revalidatePath("/student/report");
  revalidatePath("/teacher/reports");
  redirect("/student/report?success=report_submitted");
}
