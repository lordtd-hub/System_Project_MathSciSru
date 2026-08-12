"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isSchedulableRoundType, parseScheduleDateTime, roundTypeToAssessmentKind } from "@/lib/scheduling/scheduleRules";
import { validateMaterialLink } from "@/lib/validators/materialLink";
import { validateMarkdownInput } from "@/lib/validators/submissionContent";
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
import {
  deliverExamScheduleExternalNotification,
  saveAssessmentEvidenceAtomic,
  submitExamScheduleAtomic,
  submitReportVersionAtomic,
  type AssessmentEvidenceInput
} from "@/lib/projects/studentFutureStageMutations";
import { notifyAdvisorRequestSubmitted } from "@/lib/notifications/workflowEmail";

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

export async function saveAssessmentEvidence(
  _previousState: StudentActionResult,
  formData: FormData
): Promise<StudentActionResult> {
  return runStudentAction("saveAssessmentEvidence", async (requestId) => {
    const { userId, student, project } = await requireStudentContext();
    assertRateLimit(`student:${userId}:saveAssessmentEvidence`, pilotRateLimits.workflowMutation);
    const kindValue = String(formData.get("assessment_kind") ?? "");
    const roundTypeValue = kindValue === "FINAL_PRESENT" ? "FINAL_PRESENTATION" : kindValue;
    if (
      !["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENT"].includes(kindValue)
      || !isSchedulableRoundType(roundTypeValue)
    ) {
      throw new StudentActionValidationError(
        "SCHEDULE_ROUND_INVALID",
        "กรุณาเลือกรอบสอบให้ถูกต้อง",
        ["assessment_kind"]
      );
    }

    const materialLink = typedRequiredText(formData, "material_link", "ลิงก์เอกสารประกอบการสอบ");
    const linkResult = validateMaterialLink(materialLink);
    if (!linkResult.ok) {
      throw new StudentActionValidationError(
        "MATERIAL_LINK_INVALID",
        "อนุญาตเฉพาะลิงก์ https จาก Google Drive, Google Docs หรือ Google Classroom เท่านั้น",
        ["material_link"]
      );
    }

    const content: Record<string, string> = kindValue === "FINAL_PRESENT"
      ? {
          finalObjectivesEvidence: typedRequiredText(formData, "final_objectives_evidence", "วัตถุประสงค์ที่ทำสำเร็จและหลักฐาน"),
          finalMethodsResults: typedRequiredText(formData, "final_methods_results", "วิธีการ ผลลัพธ์ และการวิเคราะห์"),
          finalTimelineAdaptation: typedRequiredText(formData, "final_timeline_adaptation", "การดำเนินงานเทียบแผนและการปรับแผน"),
          finalReportReadiness: typedRequiredText(formData, "final_report_readiness", "รายงาน บทความ และประเด็นตอบคำถาม")
        }
      : {
          progressPlanTasks: typedRequiredText(formData, "progress_plan_tasks", "งานตามแผน 16 สัปดาห์ที่รายงานในรอบนี้"),
          progressEvidence: typedRequiredText(formData, "progress_evidence", "หลักฐาน/ชิ้นงานที่รองรับความก้าวหน้า"),
          progressStatus: typedRequiredText(formData, "progress_status", "สถานะงาน"),
          progressChallengesNext: typedRequiredText(formData, "progress_challenges_next", "ปัญหา วิธีแก้ และขั้นตอนถัดไป")
        };
    const summary = kindValue === "FINAL_PRESENT"
      ? [
          content.finalObjectivesEvidence,
          content.finalMethodsResults,
          content.finalTimelineAdaptation,
          content.finalReportReadiness
        ].join("\n\n")
      : [
          content.progressPlanTasks,
          content.progressEvidence,
          content.progressStatus,
          content.progressChallengesNext
        ].join("\n\n");
    for (const [field, value] of Object.entries(content)) {
      typedTextSize(value, requestSizeLimits.markdownTextBytes, field, field);
      typedMarkdown(value, field, field);
    }

    const input: AssessmentEvidenceInput = {
      kind: kindValue as AssessmentEvidenceInput["kind"],
      roundType: roundTypeValue,
      title: String(formData.get("submission_title") ?? "").trim() || null,
      materialLink: linkResult.normalizedUrl,
      contentJson: { ...content, summary },
      summary
    };
    const outcome = await saveAssessmentEvidenceAtomic(
      prisma,
      mutationContext(userId, student, project.id),
      input
    );

    revalidatePath("/student");
    revalidatePath("/student/schedule");
    revalidatePath("/teacher/schedules");
    return studentActionSuccess(
      requestId,
      "ASSESSMENT_EVIDENCE_SAVED",
      outcome.unchanged ? "เอกสารชุดนี้ถูกบันทึกไว้เรียบร้อยแล้ว" : "บันทึกเอกสารประกอบการสอบเรียบร้อยแล้ว",
      outcome.unchanged
    );
  });
}

export async function submitExamSchedule(
  _previousState: StudentActionResult,
  formData: FormData
): Promise<StudentActionResult> {
  return runStudentAction("submitExamSchedule", async (requestId) => {
    const { userId, student, project } = await requireStudentContext();
    assertRateLimit(`student:${userId}:submitExamSchedule`, pilotRateLimits.workflowMutation);
    const roundType = String(formData.get("round_type") ?? "");
    if (!isSchedulableRoundType(roundType)) {
      throw new StudentActionValidationError(
        "SCHEDULE_ROUND_INVALID",
        "กรุณาเลือกรอบสอบให้ถูกต้อง",
        ["round_type"]
      );
    }

    let parsedSchedule: ReturnType<typeof parseScheduleDateTime>;
    try {
      parsedSchedule = parseScheduleDateTime(
        String(formData.get("schedule_date") ?? ""),
        String(formData.get("start_time") ?? ""),
        String(formData.get("end_time") ?? "")
      );
    } catch {
      throw new StudentActionValidationError(
        "SCHEDULE_TIME_INVALID",
        "กรุณาระบุวันที่และเวลาให้ถูกต้อง โดยเวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม",
        ["schedule_date", "start_time", "end_time"]
      );
    }
    const room = String(formData.get("room") ?? "").trim() || null;
    const note = String(formData.get("schedule_note") ?? "").trim() || null;
    typedTextSize(note ?? "", requestSizeLimits.commentTextBytes, "หมายเหตุการนัดสอบ", "schedule_note");
    if (note) typedMarkdown(note, "หมายเหตุการนัดสอบ", "schedule_note");

    const outcome = await submitExamScheduleAtomic(
      prisma,
      mutationContext(userId, student, project.id),
      {
        roundType,
        assessmentKind: roundTypeToAssessmentKind(roundType),
        start: parsedSchedule.start,
        end: parsedSchedule.end,
        room,
        note
      }
    );
    if (!outcome.unchanged && outcome.externalNotification) {
      const notification = outcome.externalNotification;
      after(async () => {
        const startedAt = performance.now();
        try {
          await deliverExamScheduleExternalNotification(notification);
        } catch (error) {
          console.error(JSON.stringify({
            type: "student_action_after_failed",
            action: "submitExamSchedule",
            requestId,
            durationMs: Math.round(performance.now() - startedAt),
            errorName: error instanceof Error ? error.name : "UnknownError"
          }));
        }
      });
    }

    revalidatePath("/student");
    revalidatePath("/student/schedule");
    return studentActionSuccess(
      requestId,
      "EXAM_SCHEDULE_PROPOSED",
      outcome.unchanged ? "ข้อเสนอวันสอบนี้ถูกบันทึกไว้เรียบร้อยแล้ว" : "ส่งข้อเสนอวันสอบให้กรรมการพิจารณาเรียบร้อยแล้ว",
      outcome.unchanged
    );
  });
}

export async function submitReportVersion(
  _previousState: StudentActionResult,
  formData: FormData
): Promise<StudentActionResult> {
  return runStudentAction("submitReportVersion", async (requestId) => {
    const { userId, student, project } = await requireStudentContext();
    assertRateLimit(`student:${userId}:submitReportVersion`, pilotRateLimits.workflowMutation);
    const reportLink = typedRequiredText(formData, "report_drive_link", "ลิงก์เล่มรายงาน");
    const linkResult = validateMaterialLink(reportLink);
    if (!linkResult.ok) {
      throw new StudentActionValidationError(
        "MATERIAL_LINK_INVALID",
        "อนุญาตเฉพาะลิงก์ https จาก Google Drive, Google Docs หรือ Google Classroom เท่านั้น",
        ["report_drive_link"]
      );
    }
    const note = String(formData.get("report_note") ?? "").trim();
    typedTextSize(note, requestSizeLimits.commentTextBytes, "สรุปการแก้ไขรายงาน", "report_note");
    if (note) typedMarkdown(note, "สรุปการแก้ไขรายงาน", "report_note");

    const outcome = await submitReportVersionAtomic(
      prisma,
      mutationContext(userId, student, project.id),
      { driveLink: linkResult.normalizedUrl, note }
    );

    revalidatePath("/student");
    revalidatePath("/student/report");
    revalidatePath("/teacher/reports");
    return studentActionSuccess(
      requestId,
      "REPORT_VERSION_SUBMITTED",
      outcome.unchanged ? "รายงานฉบับนี้ถูกส่งไว้เรียบร้อยแล้ว" : `ส่งเล่มรายงานฉบับที่ ${outcome.versionNo} เรียบร้อยแล้ว`,
      outcome.unchanged
    );
  });
}
