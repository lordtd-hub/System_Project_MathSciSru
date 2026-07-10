"use server";

import type { AttemptType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isRoundOpen } from "@/lib/assessments/courseRounds";
import { isPresentationAssessmentComplete } from "@/lib/assessments/presentationCompletion";
import { getProgress1Readiness } from "@/lib/assessments/roundEligibility";
import { hasOpenLateRoundException, requiresLateRoundPenalty } from "@/lib/assessments/roundExceptions";
import { isSchedulableRoundType, parseScheduleDateTime, roundTypeToAssessmentKind } from "@/lib/scheduling/scheduleRules";
import { buildSubmissionSnapshot, canEditUntilDeadline, nextVersionNo } from "@/lib/submissions/versioning";
import { validateMaterialLink } from "@/lib/validators/materialLink";
import { validateMarkdownInput } from "@/lib/validators/submissionContent";
import { canStudentSubmitFinalReport } from "@/lib/reports/reportWorkflow";
import { assertRateLimit, pilotRateLimits } from "@/lib/security/rateLimit";
import { requestSizeLimits, sizeError } from "@/lib/security/requestSize";
import { parseSelectableSourceType } from "@/lib/projects/sourceType";
import { redirectWithQuery } from "@/lib/navigation/redirectWithQuery";
import { notifyAdvisorRequestSubmitted, notifyExamScheduleProposed, notifyProposalSubmitted } from "@/lib/notifications/workflowEmail";

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

function requireStudentDeclaration(formData: FormData, path: StudentFormPath) {
  if (formData.get("student_declaration") !== "on") redirectWithQuery(path, { error: "student_declaration_missing" });
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

type ProposalTimelineItem = {
  activity: string;
  startWeek: number;
  endWeek: number;
  deliverable: string;
};

function parseProposalTimelineItems(value: FormDataEntryValue | null, path: StudentFormPath): ProposalTimelineItem[] {
  if (typeof value !== "string" || !value.trim()) return [];
  let parsed: Array<Partial<ProposalTimelineItem>>;
  try {
    parsed = JSON.parse(value) as Array<Partial<ProposalTimelineItem>>;
  } catch {
    redirectWithQuery(path, { error: "student_timeline_invalid" });
  }
  return parsed
    .map((item) => {
      const startWeek = Number(item.startWeek);
      const endWeek = Number(item.endWeek);
      if (!Number.isInteger(startWeek) || !Number.isInteger(endWeek) || startWeek < 1 || startWeek > 16 || endWeek < 1 || endWeek > 16) {
        redirectWithQuery(path, { error: "student_timeline_invalid" });
      }
      if (endWeek < startWeek) redirectWithQuery(path, { error: "student_timeline_invalid" });
      return {
        activity: String(item.activity ?? "").trim(),
        startWeek,
        endWeek,
        deliverable: String(item.deliverable ?? "").trim()
      };
    })
    .filter((item) => item.activity || item.deliverable);
}

export async function saveStudentProfile(formData: FormData) {
  const { userId, student, project } = await requireStudentContext();
  const preferredName = String(formData.get("preferred_name") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const lineId = String(formData.get("line_id") ?? "").trim() || null;
  const fromStatus = project.status;

  await prisma.studentProfile.upsert({
    where: { studentId: student.id },
    update: { preferredName, phone, lineId, completedAt: new Date() },
    create: { studentId: student.id, preferredName, phone, lineId, completedAt: new Date() }
  });

  if (project.status === "STUDENT_PROFILE") {
    await prisma.$transaction([
      prisma.project.update({ where: { id: project.id }, data: { status: "DRAFT" } }),
      prisma.projectStatusHistory.create({
        data: {
          projectId: project.id,
          fromStatus,
          toStatus: "DRAFT",
          reason: "STUDENT_PROFILE_COMPLETED",
          actorUserId: userId
        }
      }),
      prisma.projectTimelineEvent.create({
        data: {
          projectId: project.id,
          eventType: "STUDENT_PROFILE_COMPLETED",
          eventTitle: "บันทึกข้อมูลนักศึกษา",
          actorUserId: userId,
          relatedEntityType: "StudentProfile",
          relatedEntityId: student.id
        }
      })
    ]);
  }

  revalidatePath("/student");
  revalidatePath("/student/profile");
  redirect("/student/profile?success=student_profile_saved");
}

export async function saveProjectOrigin(formData: FormData) {
  const { userId, student, project } = await requireStudentContext();
  assertRateLimit(`student:${userId}:saveProjectOrigin`, pilotRateLimits.workflowMutation);
  if (project.status !== "DRAFT") redirectWithQuery("/student/project", { error: "project_not_editable" });
  const materialLink = requiredText(formData, "material_link", "ลิงก์เอกสารประกอบ", "/student/project");
  const linkResult = validateMaterialLink(materialLink);
  if (!linkResult.ok) redirectWithQuery("/student/project", { error: "material_link_invalid" });
  requireStudentDeclaration(formData, "/student/project");

  const data = {
    initialProjectTitleTh: requiredText(formData, "initial_project_title_th", "ชื่อหัวข้อภาษาไทย", "/student/project"),
    initialProjectTitleEn: String(formData.get("initial_project_title_en") ?? "").trim() || null,
    sourceType: parseSelectableSourceType(formData.get("source_type")),
    reasonForTopic: requiredText(formData, "reason_for_topic", "เหตุผลที่เลือกหัวข้อ", "/student/project"),
    expectedMathArea: requiredText(formData, "expected_math_area", "ขอบเขตคณิตศาสตร์ที่เกี่ยวข้อง", "/student/project"),
    tentativeAdvisorId: String(formData.get("tentative_advisor_id") ?? "") || null,
    consultationSummary: requiredText(formData, "consultation_summary", "สรุปการปรึกษา", "/student/project"),
    initialReferences: requiredText(formData, "initial_references", "เอกสารอ้างอิงเบื้องต้น", "/student/project"),
    materialLink: linkResult.normalizedUrl,
    declarationAccepted: true,
    status: "SUBMITTED" as const,
    submittedAt: new Date()
  };
  ensureStudentTextSize(data.reasonForTopic, requestSizeLimits.markdownTextBytes, "เหตุผลที่เลือกหัวข้อ", "/student/project");
  ensureStudentTextSize(data.expectedMathArea, requestSizeLimits.markdownTextBytes, "ขอบเขตคณิตศาสตร์ที่เกี่ยวข้อง", "/student/project");
  ensureStudentTextSize(data.consultationSummary, requestSizeLimits.commentTextBytes, "สรุปการปรึกษา", "/student/project");
  ensureStudentTextSize(data.initialReferences, requestSizeLimits.markdownTextBytes, "เอกสารอ้างอิงเบื้องต้น", "/student/project");
  if (!data.tentativeAdvisorId) redirectWithQuery("/student/project", { error: "student_advisor_required" });

  const origin = await prisma.projectOrigin.upsert({
    where: { projectId: project.id },
    update: data,
    create: { ...data, projectId: project.id }
  });
  const versionCount = await prisma.projectOriginVersion.count({ where: { projectOriginId: origin.id } });
  await prisma.projectOriginVersion.create({
    data: {
      projectOriginId: origin.id,
      versionNo: nextVersionNo(versionCount),
      snapshotJson: buildSubmissionSnapshot(data),
      savedByUserId: userId
    }
  });
  if (data.tentativeAdvisorId) {
    const reminderDueAt = new Date();
    reminderDueAt.setDate(reminderDueAt.getDate() + 7);
    const existingRequest = await prisma.advisorRequest.findFirst({
      where: {
        projectId: project.id,
        advisorTeacherId: data.tentativeAdvisorId,
        status: "PENDING"
      }
    });
    if (existingRequest) {
      await prisma.advisorRequest.update({
        where: { id: existingRequest.id },
        data: {
          requestedAt: new Date(),
          reminderDueAt,
          studentMessage: data.consultationSummary
        }
      });
    } else {
      await prisma.advisorRequest.create({
        data: {
          projectId: project.id,
          studentId: student.id,
          advisorTeacherId: data.tentativeAdvisorId,
          status: "PENDING",
          studentMessage: data.consultationSummary,
          reminderDueAt
        }
      });
    }
  }
  await prisma.project.update({
    where: { id: project.id },
    data: { status: "PENDING_ADVISOR", currentTitleTh: data.initialProjectTitleTh, currentTitleEn: data.initialProjectTitleEn }
  });
  await prisma.projectStatusHistory.create({
    data: {
      projectId: project.id,
      fromStatus: project.status,
      toStatus: "PENDING_ADVISOR",
      reason: "STUDENT_SELECTED_ADVISOR",
      actorUserId: userId,
      metadataJson: { advisorReminderDays: 7 }
    }
  });
  await prisma.projectTimelineEvent.create({
    data: {
      projectId: project.id,
      eventType: "PROJECT_ORIGIN_SUBMITTED",
      eventTitle: "ส่งข้อมูลเสนอหัวข้อ",
      actorUserId: userId,
      relatedEntityType: "ProjectOrigin",
      relatedEntityId: origin.id
    }
  });
  await notifyAdvisorRequestSubmitted(project.id, data.tentativeAdvisorId).catch((error) => {
    console.error("advisor request notification failed", error);
  });

  revalidatePath("/student");
  revalidatePath("/student/origin");
  revalidatePath("/student/project");
  redirect("/student/project?success=project_submitted");
}

export async function saveProposalSubmission(formData: FormData) {
  const { userId, student, project } = await requireStudentContext();
  assertRateLimit(`student:${userId}:saveProposalSubmission`, pilotRateLimits.workflowMutation);
  if (project.status !== "PROPOSAL_PENDING") redirectWithQuery("/student/proposal", { error: "proposal_not_available" });
  const origin = await prisma.projectOrigin.findUnique({ where: { projectId: project.id } });
  if (!origin || origin.status !== "SUBMITTED") redirectWithQuery("/student/proposal", { error: "proposal_origin_missing" });

  const round = await prisma.assessmentRound.findFirst({
    where: { courseOfferingId: project.courseOfferingId, roundType: "PROPOSAL" }
  });
  if (!round) redirectWithQuery("/student/proposal", { error: "proposal_round_not_open" });
  const lateRoundExceptions = await prisma.projectRoundException.findMany({
    where: { projectId: project.id, assessmentRoundId: round.id, status: "OPEN" },
    select: { exceptionType: true, status: true }
  });
  const hasLateOverride = hasOpenLateRoundException(lateRoundExceptions);
  if (!isRoundOpen(round.status) && !hasLateOverride) redirectWithQuery("/student/proposal", { error: "proposal_round_closed_contact_admin" });
  if (!hasLateOverride && !canEditUntilDeadline(new Date(), round.submissionDeadline)) redirectWithQuery("/student/proposal", { error: "proposal_deadline_passed" });

  const materialLink = requiredText(formData, "material_link", "ลิงก์เอกสารประกอบ", "/student/proposal");
  const linkResult = validateMaterialLink(materialLink);
  if (!linkResult.ok) redirectWithQuery("/student/proposal", { error: "material_link_invalid" });
  requireStudentDeclaration(formData, "/student/proposal");

  const timelineItems = parseProposalTimelineItems(formData.get("timeline_items_json"), "/student/proposal");
  const content = {
    motivationBackground: requiredText(formData, "motivation_background", "ที่มาและความสำคัญ", "/student/proposal"),
    objectives: requiredText(formData, "objectives", "วัตถุประสงค์", "/student/proposal"),
    proposedMethods: requiredText(formData, "proposed_methods", "วิธีดำเนินงาน", "/student/proposal"),
    expectedOutcomes: requiredText(formData, "expected_outcomes", "ผลที่คาดว่าจะได้รับ", "/student/proposal"),
    timeline: requiredText(formData, "timeline", "แผนดำเนินงาน", "/student/proposal"),
    timelineItems,
    questionsForTeachers: String(formData.get("questions_for_teachers") ?? "").trim()
  };
  ensureStudentTextSize(content.questionsForTeachers, requestSizeLimits.commentTextBytes, "questions for teachers", "/student/proposal");

  const markdownErrors = [
    ...validateMarkdownInput(requiredText(formData, "abstract_of_talk", "บทคัดย่อการนำเสนอ", "/student/proposal"), "บทคัดย่อการนำเสนอ"),
    ...Object.entries(content).flatMap(([key, value]) => (key === "questionsForTeachers" || key === "timelineItems" || typeof value !== "string" ? [] : validateMarkdownInput(value, key)))
  ];
  ensureStudentMarkdown(markdownErrors, "/student/proposal");

  const attempt = await prisma.assessmentAttempt.upsert({
    where: {
      projectId_assessmentRoundId_attemptNo: {
        projectId: project.id,
        assessmentRoundId: round.id,
        attemptNo: 1
      }
    },
    update: { status: "SCORING_OPEN" },
    create: {
      projectId: project.id,
      assessmentRoundId: round.id,
      attemptNo: 1,
      attemptType: "MAIN_PROPOSAL",
      status: "SCORING_OPEN"
    }
  });

  const submissionData = {
    projectId: project.id,
    studentId: student.id,
    titleTh: requiredText(formData, "project_title_th", "ชื่อ Proposal ภาษาไทย", "/student/proposal"),
    titleEn: String(formData.get("project_title_en") ?? "").trim() || null,
    abstractText: requiredText(formData, "abstract_of_talk", "บทคัดย่อการนำเสนอ", "/student/proposal"),
    contentJson: content,
    materialLink: linkResult.normalizedUrl,
    declarationAccepted: true,
    status: "SUBMITTED" as const,
    submittedAt: new Date()
  };

  const submission = await prisma.presentationSubmission.upsert({
    where: { assessmentAttemptId: attempt.id },
    update: submissionData,
    create: { ...submissionData, assessmentAttemptId: attempt.id }
  });
  const versionCount = await prisma.presentationSubmissionVersion.count({ where: { presentationSubmissionId: submission.id } });
  await prisma.presentationSubmissionVersion.create({
    data: {
      presentationSubmissionId: submission.id,
      versionNo: nextVersionNo(versionCount),
      snapshotJson: buildSubmissionSnapshot(submissionData),
      savedByUserId: userId
    }
  });

  const proposalTeachers = await prisma.teacher.findMany({
    where: { active: true, isInternal: true, canEvaluateProposal: true, userId: { not: null } }
  });
  await Promise.all(
    proposalTeachers.map((teacher) =>
      prisma.evaluatorAssignment.upsert({
        where: { assessmentAttemptId_evaluatorUserId: { assessmentAttemptId: attempt.id, evaluatorUserId: teacher.userId! } },
        update: {
          teacherId: teacher.id,
          evaluatorDisplayNameSnapshot: `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`,
          isRequired: true
        },
        create: {
          assessmentAttemptId: attempt.id,
          evaluatorUserId: teacher.userId!,
          teacherId: teacher.id,
          evaluatorDisplayNameSnapshot: `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`,
          status: "ASSIGNED",
          isRequired: true
        }
      })
    )
  );

  await prisma.project.update({
    where: { id: project.id },
    data: { status: "PROPOSAL_REVIEW", currentTitleTh: submissionData.titleTh, currentTitleEn: submissionData.titleEn }
  });
  await prisma.projectStatusHistory.create({
    data: {
      projectId: project.id,
      fromStatus: project.status,
      toStatus: "PROPOSAL_REVIEW",
      reason: "STUDENT_ATTACHED_PROPOSAL_ABSTRACT_AND_LINK",
      actorUserId: userId
    }
  });
  await prisma.projectTimelineEvent.create({
    data: {
      projectId: project.id,
      eventType: "PROPOSAL_SUBMITTED",
      eventTitle: "ส่ง Proposal",
      actorUserId: userId,
      relatedEntityType: "PresentationSubmission",
      relatedEntityId: submission.id,
      metadataJson: {
        lateRoundOverride: hasLateOverride,
        latePenaltyRequired: requiresLateRoundPenalty(lateRoundExceptions),
        latePenaltyPercent: requiresLateRoundPenalty(lateRoundExceptions) ? 10 : 0
      }
    }
  });
  await notifyProposalSubmitted(project.id, proposalTeachers.map((teacher) => teacher.id)).catch((error) => {
    console.error("proposal notification failed", error);
  });

  revalidatePath("/student");
  revalidatePath("/student/proposal");
  redirect("/student/proposal?success=proposal_submitted");
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
