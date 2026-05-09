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
import { getReportSubmissionGate, reportSubmissionReasonLabel } from "@/lib/reports/reportWorkflow";
import { assertRateLimit, pilotRateLimits } from "@/lib/security/rateLimit";
import { assertTextSize, requestSizeLimits } from "@/lib/security/requestSize";

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
    sourceType: String(formData.get("source_type") ?? "STUDENT_INITIATED") as "STUDENT_INITIATED",
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
  if (project.status !== "PROPOSAL_PENDING") throw new Error("ยังไม่สามารถส่ง Proposal ในสถานะปัจจุบันได้");
  const origin = await prisma.projectOrigin.findUnique({ where: { projectId: project.id } });
  if (!origin || origin.status !== "SUBMITTED") throw new Error("กรุณาส่งข้อมูลเสนอหัวข้อก่อนส่ง Proposal");

  const round = await prisma.assessmentRound.findFirstOrThrow({
    where: { courseOfferingId: project.courseOfferingId, roundType: "PROPOSAL" }
  });
  if (!isRoundOpen(round.status)) throw new Error("รอบ Proposal ยังไม่เปิดหรือปิดแล้ว");
  if (!canEditUntilDeadline(new Date(), round.submissionDeadline)) throw new Error("พ้นกำหนดส่งแล้ว");

  const materialLink = requiredText(formData, "material_link", "ลิงก์เอกสารประกอบ");
  const linkResult = validateMaterialLink(materialLink);
  if (!linkResult.ok) throw new Error(linkResult.reason);
  if (formData.get("student_declaration") !== "on") throw new Error("กรุณายืนยันคำรับรองของนักศึกษา");

  const content = {
    motivationBackground: requiredText(formData, "motivation_background", "ที่มาและความสำคัญ"),
    objectives: requiredText(formData, "objectives", "วัตถุประสงค์"),
    proposedMethods: requiredText(formData, "proposed_methods", "วิธีดำเนินงาน"),
    expectedOutcomes: requiredText(formData, "expected_outcomes", "ผลที่คาดว่าจะได้รับ"),
    timeline: requiredText(formData, "timeline", "แผนดำเนินงาน"),
    questionsForTeachers: String(formData.get("questions_for_teachers") ?? "").trim()
  };
  assertTextSize(content.questionsForTeachers, requestSizeLimits.commentTextBytes, "questions for teachers");

  const markdownErrors = [
    ...validateMarkdownInput(requiredText(formData, "abstract_of_talk", "บทคัดย่อการนำเสนอ"), "บทคัดย่อการนำเสนอ"),
    ...Object.entries(content).flatMap(([key, value]) => (key === "questionsForTeachers" ? [] : validateMarkdownInput(value, key)))
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

export async function submitExamSchedule(formData: FormData) {
  const { userId, student, project } = await requireStudentContext();
  assertRateLimit(`student:${userId}:submitExamSchedule`, pilotRateLimits.workflowMutation);
  const roundType = String(formData.get("round_type") ?? "");
  if (!isSchedulableRoundType(roundType)) throw new Error("รอบสอบไม่ถูกต้อง");
  if (project.status !== "IN_PROGRESS") throw new Error("เสนอวันสอบได้เฉพาะโครงงานที่อยู่ในสถานะ IN_PROGRESS");

  const round = await prisma.assessmentRound.findUniqueOrThrow({
    where: {
      courseOfferingId_roundType: {
        courseOfferingId: project.courseOfferingId,
        roundType
      }
    }
  });
  if (!isRoundOpen(round.status)) throw new Error(`รอบ ${roundType} ยังไม่เปิดหรือปิดแล้ว`);

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
    if (!readiness.eligible) throw new Error(readiness.reasons[0] ?? "โครงงานนี้ยังไม่พร้อมสำหรับ Progress 1");
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
    assessmentKind: roundTypeToAssessmentKind(roundType),
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
      metadataJson: { roundType, proposedStartAt: start.toISOString(), room }
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
  if (!gate.allowed) throw new Error(reportSubmissionReasonLabel(gate.reason));

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
