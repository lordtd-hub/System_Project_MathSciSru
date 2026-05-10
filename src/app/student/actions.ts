"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isRoundOpen } from "@/lib/assessments/courseRounds";
import { getProgress1Readiness } from "@/lib/assessments/roundEligibility";
import { isSchedulableRoundType, parseScheduleDateTime, roundTypeToAssessmentKind } from "@/lib/scheduling/scheduleRules";
import { buildSubmissionSnapshot, canEditUntilDeadline, nextVersionNo } from "@/lib/submissions/versioning";
import { validateMaterialLink } from "@/lib/validators/materialLink";
import { validateMarkdownInput } from "@/lib/validators/submissionContent";
import { getReportSubmissionGate } from "@/lib/reports/reportWorkflow";
import { assertRateLimit, pilotRateLimits } from "@/lib/security/rateLimit";
import { assertTextSize, requestSizeLimits } from "@/lib/security/requestSize";
import { parseSelectableSourceType } from "@/lib/projects/sourceType";
import { redirectWithQuery } from "@/lib/navigation/redirectWithQuery";

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

function requiredText(formData: FormData, key: string, label: string): string {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`กรุณากรอก${label}`);
  return value;
}

type ProposalTimelineItem = {
  activity: string;
  startWeek: number;
  endWeek: number;
  deliverable: string;
};

function parseProposalTimelineItems(value: FormDataEntryValue | null): ProposalTimelineItem[] {
  if (typeof value !== "string" || !value.trim()) return [];
  const parsed = JSON.parse(value) as Array<Partial<ProposalTimelineItem>>;
  return parsed
    .map((item) => {
      const startWeek = Number(item.startWeek);
      const endWeek = Number(item.endWeek);
      if (!Number.isInteger(startWeek) || !Number.isInteger(endWeek) || startWeek < 1 || startWeek > 16 || endWeek < 1 || endWeek > 16) {
        throw new Error("สัปดาห์ในแผนดำเนินงานต้องอยู่ระหว่าง 1-16");
      }
      if (endWeek < startWeek) throw new Error("สัปดาห์สิ้นสุดต้องไม่อยู่ก่อนสัปดาห์เริ่ม");
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
  if (project.status !== "DRAFT") throw new Error("ขั้นตอนนี้ยังไม่เปิดให้แก้ไขข้อมูลโครงงาน");
  const materialLink = requiredText(formData, "material_link", "ลิงก์เอกสารประกอบ");
  const linkResult = validateMaterialLink(materialLink);
  if (!linkResult.ok) throw new Error(linkResult.reason);
  if (formData.get("student_declaration") !== "on") throw new Error("กรุณายืนยันคำรับรองของนักศึกษา");

  const data = {
    initialProjectTitleTh: requiredText(formData, "initial_project_title_th", "ชื่อหัวข้อภาษาไทย"),
    initialProjectTitleEn: String(formData.get("initial_project_title_en") ?? "").trim() || null,
    sourceType: parseSelectableSourceType(formData.get("source_type")),
    reasonForTopic: requiredText(formData, "reason_for_topic", "เหตุผลที่เลือกหัวข้อ"),
    expectedMathArea: requiredText(formData, "expected_math_area", "ขอบเขตคณิตศาสตร์ที่เกี่ยวข้อง"),
    tentativeAdvisorId: String(formData.get("tentative_advisor_id") ?? "") || null,
    consultationSummary: requiredText(formData, "consultation_summary", "สรุปการปรึกษา"),
    initialReferences: requiredText(formData, "initial_references", "เอกสารอ้างอิงเบื้องต้น"),
    materialLink: linkResult.normalizedUrl,
    declarationAccepted: true,
    status: "SUBMITTED" as const,
    submittedAt: new Date()
  };
  assertTextSize(data.reasonForTopic, requestSizeLimits.markdownTextBytes, "เหตุผลที่เลือกหัวข้อ");
  assertTextSize(data.expectedMathArea, requestSizeLimits.markdownTextBytes, "ขอบเขตคณิตศาสตร์ที่เกี่ยวข้อง");
  assertTextSize(data.consultationSummary, requestSizeLimits.commentTextBytes, "สรุปการปรึกษา");
  assertTextSize(data.initialReferences, requestSizeLimits.markdownTextBytes, "เอกสารอ้างอิงเบื้องต้น");
  if (!data.tentativeAdvisorId) throw new Error("กรุณาเลือกอาจารย์ที่ปรึกษาก่อนส่งคำขอ");

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
  if (!isRoundOpen(round.status)) redirectWithQuery("/student/proposal", { error: "proposal_round_not_open" });
  if (!canEditUntilDeadline(new Date(), round.submissionDeadline)) redirectWithQuery("/student/proposal", { error: "proposal_deadline_passed" });

  const materialLink = requiredText(formData, "material_link", "ลิงก์เอกสารประกอบ");
  const linkResult = validateMaterialLink(materialLink);
  if (!linkResult.ok) throw new Error(linkResult.reason);
  if (formData.get("student_declaration") !== "on") throw new Error("กรุณายืนยันคำรับรองของนักศึกษา");

  const timelineItems = parseProposalTimelineItems(formData.get("timeline_items_json"));
  const content = {
    motivationBackground: requiredText(formData, "motivation_background", "ที่มาและความสำคัญ"),
    objectives: requiredText(formData, "objectives", "วัตถุประสงค์"),
    proposedMethods: requiredText(formData, "proposed_methods", "วิธีดำเนินงาน"),
    expectedOutcomes: requiredText(formData, "expected_outcomes", "ผลที่คาดว่าจะได้รับ"),
    timeline: requiredText(formData, "timeline", "แผนดำเนินงาน"),
    timelineItems,
    questionsForTeachers: String(formData.get("questions_for_teachers") ?? "").trim()
  };
  assertTextSize(content.questionsForTeachers, requestSizeLimits.commentTextBytes, "questions for teachers");

  const markdownErrors = [
    ...validateMarkdownInput(requiredText(formData, "abstract_of_talk", "บทคัดย่อการนำเสนอ"), "บทคัดย่อการนำเสนอ"),
    ...Object.entries(content).flatMap(([key, value]) => (key === "questionsForTeachers" || key === "timelineItems" || typeof value !== "string" ? [] : validateMarkdownInput(value, key)))
  ];
  if (markdownErrors.length) throw new Error(markdownErrors.join("\n"));

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
    titleTh: requiredText(formData, "project_title_th", "ชื่อ Proposal ภาษาไทย"),
    titleEn: String(formData.get("project_title_en") ?? "").trim() || null,
    abstractText: requiredText(formData, "abstract_of_talk", "บทคัดย่อการนำเสนอ"),
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
      relatedEntityId: submission.id
    }
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
  if (!round || !isRoundOpen(round.status)) redirectWithQuery("/student/schedule", { error: "schedule_round_not_open" });

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

  const materialLink = requiredText(formData, "material_link", "ลิงก์เอกสารประกอบการสอบ");
  const linkResult = validateMaterialLink(materialLink);
  if (!linkResult.ok) throw new Error(linkResult.reason);
  const title = String(formData.get("submission_title") ?? "").trim() || null;
  const content = kind === "FINAL_PRESENT"
    ? {
        finalObjectivesEvidence: requiredText(formData, "final_objectives_evidence", "วัตถุประสงค์ที่ทำสำเร็จและหลักฐาน"),
        finalMethodsResults: requiredText(formData, "final_methods_results", "วิธีการ ผลลัพธ์ และการวิเคราะห์"),
        finalTimelineAdaptation: requiredText(formData, "final_timeline_adaptation", "การดำเนินงานเทียบแผนและการปรับแผน"),
        finalReportReadiness: requiredText(formData, "final_report_readiness", "รายงาน บทความ และประเด็นตอบคำถาม")
      }
    : {
        progressPlanTasks: requiredText(formData, "progress_plan_tasks", "งานตามแผน 16 สัปดาห์ที่รายงานในรอบนี้"),
        progressEvidence: requiredText(formData, "progress_evidence", "หลักฐาน/ชิ้นงานที่รองรับความก้าวหน้า"),
        progressStatus: requiredText(formData, "progress_status", "สถานะงาน"),
        progressChallengesNext: requiredText(formData, "progress_challenges_next", "ปัญหา วิธีแก้ และขั้นตอนถัดไป")
      };
  const summary = kind === "FINAL_PRESENT"
    ? [content.finalObjectivesEvidence, content.finalMethodsResults, content.finalTimelineAdaptation, content.finalReportReadiness].join("\n\n")
    : [content.progressPlanTasks, content.progressEvidence, content.progressStatus, content.progressChallengesNext].join("\n\n");
  for (const [field, value] of Object.entries(content)) {
    assertTextSize(value, requestSizeLimits.markdownTextBytes, field);
  }
  const markdownErrors = Object.entries(content).flatMap(([field, value]) => validateMarkdownInput(value, field));
  if (markdownErrors.length) throw new Error(markdownErrors.join("\n"));

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
      metadataJson: { kind, roundType, materialLink: linkResult.normalizedUrl }
    }
  });

  revalidatePath("/student");
  revalidatePath("/student/schedule");
  revalidatePath("/teacher/schedules");
  redirect("/student/schedule?success=assessment_evidence_saved");
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
  if (!isRoundOpen(round.status)) redirectWithQuery("/student/schedule", { error: "schedule_round_not_open" });
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

  const { start, end } = parseScheduleDateTime(
    String(formData.get("schedule_date") ?? ""),
    String(formData.get("start_time") ?? ""),
    String(formData.get("end_time") ?? "")
  );
  const room = String(formData.get("room") ?? "").trim() || null;
  const note = String(formData.get("schedule_note") ?? "").trim() || null;
  assertTextSize(note ?? "", requestSizeLimits.commentTextBytes, "หมายเหตุการนัดสอบ");
  if (note) {
    const noteErrors = validateMarkdownInput(note, "หมายเหตุการนัดสอบ");
    if (noteErrors.length) throw new Error(noteErrors.join("\n"));
  }

  const existing = await prisma.examScheduleProposal.findFirst({
    where: { projectId: project.id, assessmentRoundId: round.id }
  });
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
    where: { projectId: project.id, active: true, role: { in: ["HEAD", "MEMBER"] } },
    select: { teacherId: true }
  });
  await Promise.all(
    committee.map((assignment) =>
      prisma.examScheduleApproval.upsert({
        where: { scheduleProposalId_teacherId: { scheduleProposalId: schedule.id, teacherId: assignment.teacherId } },
        update: { decision: "PENDING", comment: null, decidedAt: null },
        create: { scheduleProposalId: schedule.id, teacherId: assignment.teacherId }
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
      metadataJson: { roundType, assessmentSubmissionId: evidence.id, proposedStartAt: start.toISOString(), room }
    }
  });

  revalidatePath("/student");
  revalidatePath("/student/schedule");
  redirect("/student/schedule?success=schedule_saved");
}

export async function submitReportVersion(formData: FormData) {
  const { userId, student, project } = await requireStudentContext();
  assertRateLimit(`student:${userId}:submitReportVersion`, pilotRateLimits.workflowMutation);
  const latestReport = await prisma.reportVersion.findFirst({
    where: { projectId: project.id },
    include: { reviews: true },
    orderBy: { versionNo: "desc" }
  });
  const gate = getReportSubmissionGate({
    projectStatus: project.status,
    latestReportHasRevisionRequest: Boolean(latestReport?.reviews.some((review) => review.decision === "FAIL"))
  });
  if (!gate.allowed) redirectWithQuery("/student/report", { error: "report_not_available" });

  const reportLink = requiredText(formData, "report_drive_link", "ลิงก์เล่มรายงาน");
  const linkResult = validateMaterialLink(reportLink);
  if (!linkResult.ok) throw new Error(linkResult.reason);
  const note = String(formData.get("report_note") ?? "").trim();
  assertTextSize(note, requestSizeLimits.commentTextBytes, "report note");
  if (note) {
    const noteErrors = validateMarkdownInput(note, "report note");
    if (noteErrors.length) throw new Error(noteErrors.join("\n"));
  }

  const maxVersion = await prisma.reportVersion.aggregate({
    where: { projectId: project.id },
    _max: { versionNo: true }
  });
  const versionNo = (maxVersion._max.versionNo ?? 0) + 1;
  const shouldMoveToReview = project.status === "FINAL_DONE";

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
        eventTitle: `ส่งเล่มรายงาน version ${versionNo}`,
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
