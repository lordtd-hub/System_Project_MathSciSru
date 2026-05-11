"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { isRoundOpen } from "@/lib/assessments/courseRounds";
import { isPresentationAssessmentComplete } from "@/lib/assessments/presentationCompletion";
import { prisma } from "@/lib/db";
import { createActionTimer } from "@/lib/diagnostics/actionTiming";
import { redirectWithQuery } from "@/lib/navigation/redirectWithQuery";
import { assertRateLimit, pilotRateLimits } from "@/lib/security/rateLimit";
import { assertTextSize, requestSizeLimits } from "@/lib/security/requestSize";
import { advisorApproveTransition, advisorRejectTransition } from "@/lib/lifecycle/transitions";
import { totalAdvisorScore, validateAdvisorScore, type AdvisorScoreInput } from "@/lib/scoring/advisorScoring";
import { validateProposalDecision } from "@/lib/scoring/checklistScoring";
import { calculateCriterionScore, findProposalQaCriterion } from "@/lib/rubrics/proposalQaRubric";
import { ensureProposalConditionRubric } from "@/lib/rubrics/ensureProposalConditionRubric";
import { calculateFinalQaCriterionScore, finalQaRubricItems, findFinalQaCriterion } from "@/lib/rubrics/finalQaRubric";
import { calculateProgressQaCriterionScore, findProgressQaCriterion, progressQaRubricItems } from "@/lib/rubrics/progressQaRubric";
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

async function assertScoreNotAlreadySubmitted(projectId: string, assessmentRoundId: string, teacherId: string, label: string) {
  const existingSubmission = await prisma.scoreSubmission.findFirst({
    where: {
      status: "SUBMITTED",
      evaluatorAssignment: {
        teacherId,
        assessmentAttempt: {
          projectId,
          assessmentRoundId
        }
      }
    },
    select: { id: true }
  });
  if (existingSubmission) {
    throw new Error(`${label} บันทึกคะแนนของอาจารย์ท่านนี้แล้ว ไม่สามารถส่งซ้ำได้`);
  }
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
}

export async function openProposalScoring(formData: FormData) {
  const user = await requireTeacherUser();
  assertRateLimit(`teacher:${user.id}:openProposalScoring`, pilotRateLimits.workflowMutation);
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติก่อน");
  const attemptId = String(formData.get("attempt_id"));

  const teacher = await prisma.teacher.findUniqueOrThrow({ where: { userId: user.id } });
  const attempt = await prisma.assessmentAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    select: { assessmentRound: { select: { roundType: true, status: true } } }
  });
  if (attempt.assessmentRound.roundType !== "PROPOSAL" || attempt.assessmentRound.status !== "SCORING_OPEN") {
    redirectWithQuery("/teacher/proposals", { error: "proposal_round_not_open" });
  }
  await prisma.evaluatorAssignment.upsert({
    where: { assessmentAttemptId_evaluatorUserId: { assessmentAttemptId: attemptId, evaluatorUserId: user.id } },
    update: { status: "IN_PROGRESS" },
    create: {
      assessmentAttemptId: attemptId,
      evaluatorUserId: user.id,
      teacherId: teacher.id,
      evaluatorDisplayNameSnapshot: `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`,
      status: "IN_PROGRESS",
      isRequired: false
    }
  });

  revalidatePath("/teacher");
}

export async function reviewAdvisorRequest(formData: FormData) {
  const user = await requireTeacherUser();
  assertRateLimit(`teacher:${user.id}:reviewAdvisorRequest`, pilotRateLimits.workflowMutation);
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");
  const requestId = String(formData.get("request_id"));
  const decision = String(formData.get("decision"));
  const comment = String(formData.get("comment") ?? "").trim();
  assertTextSize(comment, requestSizeLimits.commentTextBytes, "ข้อเสนอแนะต่อคำขอที่ปรึกษา");
  if (!["APPROVE", "REJECT"].includes(decision)) throw new Error("ผลการพิจารณาไม่ถูกต้อง");
  if (decision === "REJECT" && !comment) throw new Error("กรุณาระบุเหตุผลเมื่อปฏิเสธคำขอที่ปรึกษา");

  const teacher = await prisma.teacher.findUniqueOrThrow({ where: { userId: user.id } });
  const request = await prisma.advisorRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { project: true }
  });
  if (request.advisorTeacherId !== teacher.id) throw new Error("ไม่สามารถพิจารณาคำขอของอาจารย์ท่านอื่นได้");
  if (request.status !== "PENDING") throw new Error("คำขอนี้ถูกพิจารณาแล้ว");

  const transition =
    decision === "APPROVE"
      ? advisorApproveTransition(request.project.status)
      : advisorRejectTransition(request.project.status);

  await prisma.$transaction([
    prisma.advisorRequest.update({
      where: { id: requestId },
      data: {
        status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
        advisorComment: comment || null,
        reviewedAt: new Date()
      }
    }),
    prisma.project.update({
      where: { id: request.projectId },
      data: { status: transition.to }
    }),
    prisma.projectStatusHistory.create({
      data: {
        projectId: request.projectId,
        fromStatus: transition.from,
        toStatus: transition.to,
        reason: transition.reason,
        actorUserId: user.id,
        metadataJson: { advisorRequestId: requestId, comment: comment || null }
      }
    }),
    prisma.projectTimelineEvent.create({
      data: {
        projectId: request.projectId,
        eventType: decision === "APPROVE" ? "ADVISOR_REQUEST_APPROVED" : "ADVISOR_REQUEST_REJECTED",
        eventTitle: decision === "APPROVE" ? "อาจารย์ที่ปรึกษาอนุมัติ" : "อาจารย์ที่ปรึกษาปฏิเสธ",
        eventDescription: comment || null,
        actorUserId: user.id,
        relatedEntityType: "AdvisorRequest",
        relatedEntityId: requestId
      }
    })
  ]);

  revalidatePath("/teacher/advisor-requests");
  redirect("/teacher/advisor-requests?success=advisor_request_reviewed");
}

export async function reviewExamSchedule(formData: FormData) {
  const user = await requireTeacherUser();
  assertRateLimit(`teacher:${user.id}:reviewExamSchedule`, pilotRateLimits.workflowMutation);
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");

  const scheduleId = String(formData.get("schedule_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  assertTextSize(comment, requestSizeLimits.commentTextBytes, "ความเห็นต่อคำขอวันสอบ");
  if (decision !== "APPROVE" && decision !== "REJECT") throw new Error("ผลการพิจารณาวันสอบไม่ถูกต้อง");
  if (decision === "REJECT" && !comment) throw new Error("กรุณาระบุเหตุผลเมื่อไม่อนุมัติวันสอบ");
  if (comment) {
    const commentErrors = validateMarkdownInput(comment, "ความเห็นต่อคำขอวันสอบ");
    if (commentErrors.length) throw new Error(commentErrors.join("\n"));
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
          advisorRequests: { where: { status: "APPROVED" } }
        }
      }
    }
  });
  if (schedule.status !== "PROPOSED") {
    redirectWithQuery("/teacher/schedules", { error: "schedule_already_reviewed" });
  }
  if (schedule.assessmentRound && !isRoundOpen(schedule.assessmentRound.status)) {
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

  await prisma.$transaction(async (tx) => {
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
  });

  revalidatePath("/teacher");
  revalidatePath("/teacher/schedules");
  revalidatePath("/student");
  revalidatePath("/student/schedule");
  revalidatePath("/admin/schedules");
  redirectWithQuery("/teacher/schedules", { success: decision === "APPROVE" ? "schedule_approved" : "schedule_rejected" });
}

export async function submitProposalScore(formData: FormData) {
  const user = await requireTeacherUser();
  assertRateLimit(`teacher:${user.id}:submitProposalScore`, pilotRateLimits.scoring);
  const timer = createActionTimer("teacher.submitProposalScore");
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติก่อน");

  const assignmentId = String(formData.get("assignment_id"));
  const decision = String(formData.get("decision")) as "PASS" | "PASS_WITH_REVISION" | "NOT_PASS";
  const reason = String(formData.get("reason") ?? "").trim();
  const overallComment = String(formData.get("overall_comment") ?? "").trim();
  assertTextSize(reason, requestSizeLimits.shortReasonBytes, "proposal decision reason");
  assertTextSize(overallComment, requestSizeLimits.commentTextBytes, "ข้อเสนอแนะภาพรวมการเสนอหัวข้อ");
  const submitMode = String(formData.get("submit_mode"));

  const assignment = await timer.measure("load_assignment", () => prisma.evaluatorAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: {
      assessmentAttempt: { include: { assessmentRound: true } },
      scoreSubmission: { select: { status: true, lockedAt: true } }
    }
  }));
  if (assignment.evaluatorUserId !== user.id) throw new Error("ไม่สามารถบันทึกคะแนนของผู้อื่นได้");
  if (!assignment.teacherId) throw new Error("ไม่พบข้อมูลอาจารย์ผู้ประเมิน");
  if (assignment.status === "SUBMITTED" || assignment.scoreSubmission?.status === "SUBMITTED" || assignment.scoreSubmission?.lockedAt) {
    redirectWithQuery(`/teacher/scoring/${encodeURIComponent(assignmentId)}`, { error: "proposal_score_locked" });
  }
  if (assignment.assessmentAttempt.assessmentRound.status !== "SCORING_OPEN") {
    redirectWithQuery(`/teacher/scoring/${encodeURIComponent(assignmentId)}`, { error: "proposal_round_not_open" });
  }

  const rubric = await timer.measure("load_rubric", () => ensureProposalConditionRubric(prisma));
  if (!rubric || rubric.items.length === 0) {
    redirectWithQuery(`/teacher/scoring/${encodeURIComponent(assignmentId)}`, { error: "proposal_rubric_missing" });
  }

  const checkedIds = new Set(formData.getAll("checked_item").map(String));
  const scoredItems = rubric.items.map((item) => {
    const proposalCriterion = findProposalQaCriterion(item.itemKey);
    if (proposalCriterion) {
      const rawConditionCount = Number(formData.get(`condition_count:${item.id}`) ?? 0);
      const conditionCount = Number.isFinite(rawConditionCount) ? rawConditionCount : 0;
      const pointsAwarded = calculateCriterionScore(proposalCriterion, conditionCount);
      return { item, checked: pointsAwarded > 0, pointsAwarded };
    }

    const checked = checkedIds.has(item.id);
    return { item, checked, pointsAwarded: checked ? item.points : 0 };
  });
  const scoreResult = {
    totalScore: scoredItems.reduce((sum, scoredItem) => sum + scoredItem.pointsAwarded, 0),
    maxScore: rubric.items.reduce((sum, item) => sum + item.points, 0),
    criticalWarnings: scoredItems.filter((scoredItem) => scoredItem.item.isCritical && scoredItem.pointsAwarded === 0).map((scoredItem) => scoredItem.item.itemLabelTh)
  };
  const decisionErrors = submitMode === "submit" ? validateProposalDecision(decision, reason) : [];
  if (submitMode === "submit" && !overallComment) {
    decisionErrors.push("กรุณาระบุข้อเสนอแนะเพื่อให้นักศึกษาใช้ปรับปรุงงาน");
  }
  if (decisionErrors.length) throw new Error(decisionErrors.join("\n"));

  const scoreSubmission = await timer.measure("upsert_score_submission", () => prisma.scoreSubmission.upsert({
    where: { evaluatorAssignmentId: assignmentId },
    update: {
      totalScore: scoreResult.totalScore,
      overallComment,
      status: submitMode === "submit" ? "SUBMITTED" : "DRAFT",
      submittedAt: submitMode === "submit" ? new Date() : null,
      lockedAt: submitMode === "submit" ? new Date() : null
    },
    create: {
      evaluatorAssignmentId: assignmentId,
      totalScore: scoreResult.totalScore,
      overallComment,
      status: submitMode === "submit" ? "SUBMITTED" : "DRAFT",
      submittedAt: submitMode === "submit" ? new Date() : null,
      lockedAt: submitMode === "submit" ? new Date() : null
    }
  }));

  await timer.measure("upsert_score_items", () => Promise.all(
    scoredItems.map(({ item, checked, pointsAwarded }) =>
      prisma.scoreItem.upsert({
        where: { scoreSubmissionId_rubricItemId: { scoreSubmissionId: scoreSubmission.id, rubricItemId: item.id } },
        update: {
          checked,
          pointsAwarded
        },
        create: {
          scoreSubmissionId: scoreSubmission.id,
          rubricItemId: item.id,
          checked,
          pointsAwarded
        }
      })
    )
  ));

  await prisma.proposalEvaluatorDecision.upsert({
    where: { scoreSubmissionId: scoreSubmission.id },
    update: { decision, reason: reason || null },
    create: { scoreSubmissionId: scoreSubmission.id, decision, reason: reason || null }
  });
  await prisma.proposalVote.upsert({
    where: {
      projectId_teacherId_assessmentAttemptId: {
        projectId: assignment.assessmentAttempt.projectId,
        teacherId: assignment.teacherId,
        assessmentAttemptId: assignment.assessmentAttemptId
      }
    },
    update: {
      vote: decision === "PASS" ? "PASS" : decision === "PASS_WITH_REVISION" ? "REVISE" : "FAIL",
      comment: overallComment || reason || null,
      visibleToStudent: true,
      submittedAt: new Date()
    },
    create: {
      projectId: assignment.assessmentAttempt.projectId,
      assessmentAttemptId: assignment.assessmentAttemptId,
      teacherId: assignment.teacherId,
      vote: decision === "PASS" ? "PASS" : decision === "PASS_WITH_REVISION" ? "REVISE" : "FAIL",
      comment: overallComment || reason || null,
      visibleToStudent: true
    }
  });

  if (submitMode === "submit") {
    await prisma.evaluatorAssignment.update({ where: { id: assignmentId }, data: { status: "SUBMITTED" } });
    const remainingAssignments = await prisma.evaluatorAssignment.count({
      where: {
        assessmentAttemptId: assignment.assessmentAttemptId,
        status: { not: "SUBMITTED" }
      }
    });
    if (remainingAssignments === 0) {
      const project = await prisma.project.findUniqueOrThrow({ where: { id: assignment.assessmentAttempt.projectId } });
      if (project.status === "PROPOSAL_REVIEW") {
        await prisma.project.update({
          where: { id: project.id },
          data: { status: "PROPOSAL_ADMIN_DECISION" }
        });
        await prisma.projectStatusHistory.create({
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
    await prisma.projectTimelineEvent.create({
      data: {
        projectId: assignment.assessmentAttempt.projectId,
        eventType: "TEACHER_SCORE_SUBMITTED",
        eventTitle: "อาจารย์ส่งคะแนนการเสนอหัวข้อ",
        actorUserId: user.id,
        relatedEntityType: "ScoreSubmission",
        relatedEntityId: scoreSubmission.id,
        metadataJson: { totalScore: scoreResult.totalScore, criticalWarnings: scoreResult.criticalWarnings }
      }
    });
  }

  revalidatePath(`/teacher/scoring/${assignmentId}`);
  timer.end("redirect");
  redirectWithQuery(`/teacher/scoring/${encodeURIComponent(assignmentId)}`, { success: "proposal_score_saved" });
}

async function ensureProgress1Rubric() {
  const existing = await prisma.rubric.findFirst({
    where: { roundType: "PROGRESS_1", active: true },
    include: { items: { orderBy: { displayOrder: "asc" } } }
  });
  const items = progressQaRubricItems();
  const hasConditionItems = existing?.items.some((item) => Boolean(findProgressQaCriterion(item.itemKey)));
  if (existing && hasConditionItems) {
    await Promise.all(items.map((item) =>
      prisma.rubricItem.updateMany({
        where: { rubricId: existing.id, itemKey: item.itemKey },
        data: { groupLabelTh: item.groupLabelTh, itemLabelTh: item.itemLabelTh, evidenceHint: item.evidenceHint }
      })
    ));
    return prisma.rubric.findUniqueOrThrow({
      where: { id: existing.id },
      include: { items: { orderBy: { displayOrder: "asc" } } }
    });
  }

  const latest = await prisma.rubric.findFirst({ where: { roundType: "PROGRESS_1" }, orderBy: { version: "desc" } });
  await prisma.rubric.updateMany({ where: { roundType: "PROGRESS_1", active: true }, data: { active: false } });
  return prisma.rubric.create({
    data: {
      roundType: "PROGRESS_1",
      name: "เกณฑ์ประเมินความก้าวหน้าครั้งที่ 1 ตามแผนงาน",
      version: (latest?.version ?? 0) + 1,
      active: true,
      items: {
        create: items.map((item) => ({
          groupKey: item.groupKey,
          groupLabelTh: item.groupLabelTh,
          itemKey: item.itemKey,
          itemLabelTh: item.itemLabelTh,
          points: item.points,
          displayOrder: item.displayOrder,
          isCritical: item.isCritical,
          evidenceHint: item.evidenceHint
        }))
      }
    },
    include: { items: { orderBy: { displayOrder: "asc" } } }
  });
}

async function ensureProgress2Rubric() {
  const existing = await prisma.rubric.findFirst({
    where: { roundType: "PROGRESS_2", active: true },
    include: { items: { orderBy: { displayOrder: "asc" } } }
  });
  const items = progressQaRubricItems();
  const hasConditionItems = existing?.items.some((item) => Boolean(findProgressQaCriterion(item.itemKey)));
  if (existing && hasConditionItems) {
    await Promise.all(items.map((item) =>
      prisma.rubricItem.updateMany({
        where: { rubricId: existing.id, itemKey: item.itemKey },
        data: { groupLabelTh: item.groupLabelTh, itemLabelTh: item.itemLabelTh, evidenceHint: item.evidenceHint }
      })
    ));
    return prisma.rubric.findUniqueOrThrow({
      where: { id: existing.id },
      include: { items: { orderBy: { displayOrder: "asc" } } }
    });
  }

  const latest = await prisma.rubric.findFirst({ where: { roundType: "PROGRESS_2" }, orderBy: { version: "desc" } });
  await prisma.rubric.updateMany({ where: { roundType: "PROGRESS_2", active: true }, data: { active: false } });
  return prisma.rubric.create({
    data: {
      roundType: "PROGRESS_2",
      name: "เกณฑ์ประเมินความก้าวหน้าครั้งที่ 2 ตามแผนงาน",
      version: (latest?.version ?? 0) + 1,
      active: true,
      items: {
        create: items.map((item) => ({
          groupKey: item.groupKey,
          groupLabelTh: item.groupLabelTh,
          itemKey: item.itemKey,
          itemLabelTh: item.itemLabelTh,
          points: item.points,
          displayOrder: item.displayOrder,
          isCritical: item.isCritical,
          evidenceHint: item.evidenceHint
        }))
      }
    },
    include: { items: { orderBy: { displayOrder: "asc" } } }
  });
}

async function ensureFinalRubric() {
  const existing = await prisma.rubric.findFirst({
    where: { roundType: "FINAL_PRESENTATION", active: true },
    include: { items: { orderBy: { displayOrder: "asc" } } }
  });
  const finalItems = finalQaRubricItems();
  const hasExpectedItems = existing?.items.some((item) => Boolean(findFinalQaCriterion(item.itemKey)));
  if (existing && hasExpectedItems) {
    await Promise.all(finalItems.map((item) =>
      prisma.rubricItem.updateMany({
        where: { rubricId: existing.id, itemKey: item.itemKey },
        data: { groupLabelTh: item.groupLabelTh, itemLabelTh: item.itemLabelTh, evidenceHint: item.evidenceHint }
      })
    ));
    return prisma.rubric.findUniqueOrThrow({
      where: { id: existing.id },
      include: { items: { orderBy: { displayOrder: "asc" } } }
    });
  }

  const latest = await prisma.rubric.findFirst({ where: { roundType: "FINAL_PRESENTATION" }, orderBy: { version: "desc" } });
  await prisma.rubric.updateMany({ where: { roundType: "FINAL_PRESENTATION", active: true }, data: { active: false } });
  return prisma.rubric.create({
    data: {
      roundType: "FINAL_PRESENTATION",
      name: "เกณฑ์ประเมินการสอบนำเสนอขั้นสุดท้ายตามหลักฐาน",
      version: (latest?.version ?? 0) + 1,
      active: true,
      items: {
        create: finalItems.map((item) => ({
          groupKey: item.groupKey,
          groupLabelTh: item.groupLabelTh,
          itemKey: item.itemKey,
          itemLabelTh: item.itemLabelTh,
          points: item.points,
          displayOrder: item.displayOrder,
          isCritical: item.isCritical,
          evidenceHint: item.evidenceHint
        }))
      }
    },
    include: { items: { orderBy: { displayOrder: "asc" } } }
  });
}

export async function submitProgress1Score(formData: FormData) {
  const user = await requireTeacherUser();
  assertRateLimit(`teacher:${user.id}:submitProgress1Score`, pilotRateLimits.scoring);
  const timer = createActionTimer("teacher.submitProgress1Score");
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");
  const projectId = String(formData.get("project_id") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  assertTextSize(comment, requestSizeLimits.commentTextBytes, "ข้อเสนอแนะการสอบความก้าวหน้าครั้งที่ 1");
  const input: Progress1ScoreInput = {
    progress: Number(formData.get("progress")),
    problemSolving: Number(formData.get("problem_solving")),
    researchResults: Number(formData.get("research_results")),
    presentation: Number(formData.get("presentation")),
    overall: Number(formData.get("overall"))
  };
  const errors = validateProgress1Score(input);
  if (comment) errors.push(...validateMarkdownInput(comment, "ข้อเสนอแนะการสอบความก้าวหน้าครั้งที่ 1"));
  if (errors.length) throw new Error(errors.join("\n"));

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
  await assertScoreNotAlreadySubmitted(project.id, round.id, teacher.id, "การสอบความก้าวหน้าครั้งที่ 1");
  const rubric = await timer.measure("ensure_rubric", () => ensureProgress1Rubric());
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
  const scoreSubmission = await prisma.scoreSubmission.upsert({
    where: { evaluatorAssignmentId: assignment.id },
    update: { totalScore: progressTotalScore, overallComment: comment || null, status: "SUBMITTED", submittedAt: new Date(), lockedAt: new Date() },
    create: { evaluatorAssignmentId: assignment.id, totalScore: progressTotalScore, overallComment: comment || null, status: "SUBMITTED", submittedAt: new Date(), lockedAt: new Date() }
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
      eventTitle: "บันทึกคะแนนการสอบความก้าวหน้าครั้งที่ 1",
      eventDescription: comment || null,
      actorUserId: user.id,
      relatedEntityType: "ScoreSubmission",
      relatedEntityId: scoreSubmission.id,
      metadataJson: { totalScore: progressTotalScore }
    }
  }));

  revalidatePath("/teacher/progress1");
  revalidatePath("/teacher");
  revalidatePath("/student");
  timer.end("redirect");
  redirect("/teacher/progress1?success=progress_1_score_saved");
}

export async function submitProgress2Score(formData: FormData) {
  const user = await requireTeacherUser();
  assertRateLimit(`teacher:${user.id}:submitProgress2Score`, pilotRateLimits.scoring);
  const timer = createActionTimer("teacher.submitProgress2Score");
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");
  const projectId = String(formData.get("project_id") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  assertTextSize(comment, requestSizeLimits.commentTextBytes, "ข้อเสนอแนะการสอบความก้าวหน้าครั้งที่ 2");
  const input: Progress2ScoreInput = {
    progress: Number(formData.get("progress")),
    problemSolving: Number(formData.get("problem_solving")),
    researchResults: Number(formData.get("research_results")),
    presentation: Number(formData.get("presentation")),
    overall: Number(formData.get("overall"))
  };
  const errors = validateProgress2Score(input);
  if (comment) errors.push(...validateMarkdownInput(comment, "ข้อเสนอแนะการสอบความก้าวหน้าครั้งที่ 2"));
  if (errors.length) throw new Error(errors.join("\n"));

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
  await assertScoreNotAlreadySubmitted(project.id, round.id, teacher.id, "การสอบความก้าวหน้าครั้งที่ 2");
  const rubric = await timer.measure("ensure_rubric", () => ensureProgress2Rubric());
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
  const scoreSubmission = await prisma.scoreSubmission.upsert({
    where: { evaluatorAssignmentId: assignment.id },
    update: { totalScore: progressTotalScore, overallComment: comment || null, status: "SUBMITTED", submittedAt: new Date(), lockedAt: new Date() },
    create: { evaluatorAssignmentId: assignment.id, totalScore: progressTotalScore, overallComment: comment || null, status: "SUBMITTED", submittedAt: new Date(), lockedAt: new Date() }
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
      eventTitle: "บันทึกคะแนนการสอบความก้าวหน้าครั้งที่ 2",
      eventDescription: comment || null,
      actorUserId: user.id,
      relatedEntityType: "ScoreSubmission",
      relatedEntityId: scoreSubmission.id,
      metadataJson: { totalScore: progressTotalScore }
    }
  }));

  revalidatePath("/teacher/progress2");
  revalidatePath("/teacher");
  revalidatePath("/student");
  timer.end("redirect");
  redirect("/teacher/progress2?success=progress_2_score_saved");
}

export async function submitFinalPresentationScore(formData: FormData) {
  const user = await requireTeacherUser();
  assertRateLimit(`teacher:${user.id}:submitFinalPresentationScore`, pilotRateLimits.scoring);
  const timer = createActionTimer("teacher.submitFinalPresentationScore");
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");
  const projectId = String(formData.get("project_id") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  assertTextSize(comment, requestSizeLimits.commentTextBytes, "ข้อเสนอแนะการสอบนำเสนอขั้นสุดท้าย");
  const errors: string[] = [];
  if (comment) errors.push(...validateMarkdownInput(comment, "ข้อเสนอแนะการสอบนำเสนอขั้นสุดท้าย"));
  if (errors.length) throw new Error(errors.join("\n"));

  const teacher = await timer.measure("load_teacher", () => prisma.teacher.findUniqueOrThrow({ where: { userId: user.id } }));
  const project = await timer.measure("load_project", () => prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { committeeAssignments: true }
  }));
  if (project.status !== "IN_PROGRESS") throw new Error("บันทึกคะแนนสอบนำเสนอขั้นสุดท้ายได้เฉพาะโครงงานที่อยู่ระหว่างดำเนินงาน");
  const assigned = project.committeeAssignments.some(
    (assignment) => assignment.active && assignment.teacherId === teacher.id && ["HEAD", "MEMBER"].includes(assignment.role)
  );
  if (!assigned) throw new Error("เฉพาะประธานกรรมการหรือกรรมการที่ได้รับแต่งตั้งเท่านั้นที่บันทึกคะแนนสอบนำเสนอขั้นสุดท้ายได้");
  await assertConfirmedSchedule(project.id, "FINAL_PRESENT", "การสอบนำเสนอขั้นสุดท้าย");

  const round = await timer.measure("load_round", () => prisma.assessmentRound.findUnique({
    where: { courseOfferingId_roundType: { courseOfferingId: project.courseOfferingId, roundType: "FINAL_PRESENTATION" } }
  }));
  if (!round) throw new Error("ยังไม่มีรอบสอบนำเสนอขั้นสุดท้ายระดับรายวิชา");

  await assertScoreNotAlreadySubmitted(project.id, round.id, teacher.id, "การสอบนำเสนอขั้นสุดท้าย");
  const rubric = await timer.measure("ensure_rubric", () => ensureFinalRubric());
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
  const scoreSubmission = await prisma.scoreSubmission.upsert({
    where: { evaluatorAssignmentId: assignment.id },
    update: {
      totalScore: finalTotalScore,
      overallComment: comment || null,
      status: "SUBMITTED",
      submittedAt: new Date(),
      lockedAt: new Date()
    },
    create: {
      evaluatorAssignmentId: assignment.id,
      totalScore: finalTotalScore,
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
      eventTitle: "บันทึกคะแนนการสอบนำเสนอขั้นสุดท้าย",
      eventDescription: comment || null,
      actorUserId: user.id,
      relatedEntityType: "ScoreSubmission",
      relatedEntityId: scoreSubmission.id,
      metadataJson: { rubricMode: "condition_based_final", totalScore: finalTotalScore }
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
  redirect("/teacher/final?success=final_score_saved");
}

export async function reviewReportVersion(formData: FormData) {
  const user = await requireTeacherUser();
  assertRateLimit(`teacher:${user.id}:reviewReportVersion`, pilotRateLimits.workflowMutation);
  const timer = createActionTimer("teacher.reviewReportVersion");
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");
  const reportVersionId = String(formData.get("report_version_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  assertTextSize(comment, requestSizeLimits.commentTextBytes, "ข้อเสนอแนะการตรวจรายงาน");
  if (decision !== "PASS" && decision !== "FAIL") throw new Error("ผลการตรวจเล่มไม่ถูกต้อง");
  if (!comment) throw new Error("กรุณาระบุข้อเสนอแนะสำหรับผลการตรวจรายงาน");
  const commentErrors = validateMarkdownInput(comment, "ข้อเสนอแนะการตรวจรายงาน");
  if (commentErrors.length) throw new Error(commentErrors.join("\n"));

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
    throw new Error("ตรวจรายงานได้เฉพาะโครงงานที่อยู่ระหว่างขั้นตอนตรวจรายงาน");
  }
  if (reportVersion.project.reportVersions[0]?.id !== reportVersion.id) {
    throw new Error("กรุณาตรวจรายงานฉบับล่าสุดเท่านั้น");
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

  const review = await timer.measure("upsert_report_review", () => prisma.reportReview.upsert({
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
  }));

  if (decision === "FAIL") {
    await prisma.projectTimelineEvent.create({
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
    revalidatePath("/teacher/reports");
    revalidatePath("/student/report");
    timer.end("redirect_revision");
    redirect("/teacher/reports?success=report_revision_requested");
  }

  const requiredReviewerIds = requiredReportReviewerIds(
    reportVersion.project.committeeAssignments,
    reportVersion.project.advisorRequests
  );
  const latestReviews = await prisma.reportReview.findMany({
    where: { reportVersionId: reportVersion.id }
  });
  const approved =
    !latestReportVersionHasRevisionRequest(latestReviews) &&
    allRequiredReportReviewersPassed({ requiredReviewerIds, reviews: latestReviews });

  await timer.measure("approval_transaction", () => prisma.$transaction(async (tx) => {
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
  }));

  revalidatePath("/teacher/reports");
  revalidatePath("/student/report");
  timer.end("redirect");
  redirect(approved ? "/teacher/reports?success=report_approved" : "/teacher/reports?success=report_review_saved");
}

export async function submitAdvisorScore(formData: FormData) {
  const user = await requireTeacherUser();
  assertRateLimit(`teacher:${user.id}:submitAdvisorScore`, pilotRateLimits.scoring);
  const timer = createActionTimer("teacher.submitAdvisorScore");
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");
  const projectId = String(formData.get("project_id") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  assertTextSize(comment, requestSizeLimits.commentTextBytes, "ข้อเสนอแนะคะแนนสรุปของอาจารย์ที่ปรึกษา");
  const input: AdvisorScoreInput = {
    responsibility: Number(formData.get("responsibility")),
    researchProcess: Number(formData.get("research_process")),
    problemSolving: Number(formData.get("problem_solving")),
    communication: Number(formData.get("communication")),
    professionalism: Number(formData.get("professionalism"))
  };
  const errors = validateAdvisorScore(input);
  if (comment) errors.push(...validateMarkdownInput(comment, "ข้อเสนอแนะคะแนนสรุปของอาจารย์ที่ปรึกษา"));
  if (errors.length) throw new Error(errors.join("\n"));

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
        eventTitle: "บันทึกคะแนนสรุปของอาจารย์ที่ปรึกษา 25%",
        eventDescription: comment || null,
        actorUserId: user.id,
        relatedEntityType: "AdvisorScore",
        relatedEntityId: saved.id,
        metadataJson: { totalScore: total }
      }
    });

    return saved;
  }));

  revalidatePath("/teacher/advisor-score");
  revalidatePath("/student/report");
  timer.end("redirect");
  redirectWithQuery("/teacher/advisor-score", { success: "advisor_score_saved", score_id: score.id });
}
