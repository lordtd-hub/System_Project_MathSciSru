"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { prisma } from "@/lib/db";
import { createActionTimer } from "@/lib/diagnostics/actionTiming";
import { redirectWithQuery } from "@/lib/navigation/redirectWithQuery";
import { advisorApproveTransition, advisorRejectTransition } from "@/lib/lifecycle/transitions";
import { finalCriteria, totalFinalNormalizedScore, totalFinalRawScore, validateFinalScore, type FinalScoreInput } from "@/lib/scoring/finalScoring";
import { totalAdvisorScore, validateAdvisorScore, type AdvisorScoreInput } from "@/lib/scoring/advisorScoring";
import { calculateChecklistScore, validateProposalDecision } from "@/lib/scoring/checklistScoring";
import {
  progress1Criteria,
  progress2Criteria,
  totalProgress1Score,
  totalProgress2Score,
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
    throw new Error("Teacher claim is available only before admin approval");
  }
  return session.user;
}

export async function claimTeacherProfile(formData: FormData) {
  const user = await requirePendingTeacherClaimUser();
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
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติก่อน");
  const attemptId = String(formData.get("attempt_id"));

  const teacher = await prisma.teacher.findUniqueOrThrow({ where: { userId: user.id } });
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
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");
  const requestId = String(formData.get("request_id"));
  const decision = String(formData.get("decision"));
  const comment = String(formData.get("comment") ?? "").trim();
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

export async function submitProposalScore(formData: FormData) {
  const user = await requireTeacherUser();
  const timer = createActionTimer("teacher.submitProposalScore");
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติก่อน");

  const assignmentId = String(formData.get("assignment_id"));
  const decision = String(formData.get("decision")) as "PASS" | "PASS_WITH_REVISION" | "NOT_PASS";
  const reason = String(formData.get("reason") ?? "").trim();
  const overallComment = String(formData.get("overall_comment") ?? "").trim();
  const submitMode = String(formData.get("submit_mode"));

  const assignment = await timer.measure("load_assignment", () => prisma.evaluatorAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: { assessmentAttempt: true }
  }));
  if (assignment.evaluatorUserId !== user.id) throw new Error("ไม่สามารถบันทึกคะแนนของผู้อื่นได้");
  if (!assignment.teacherId) throw new Error("ไม่พบข้อมูลอาจารย์ผู้ประเมิน");

  const rubric = await timer.measure("load_rubric", () => prisma.rubric.findFirstOrThrow({
    where: { roundType: "PROPOSAL", active: true },
    include: { items: { orderBy: { displayOrder: "asc" } } }
  }));

  const checkedIds = new Set(formData.getAll("checked_item").map(String));
  const scoreResult = calculateChecklistScore(
    rubric.items.map((item) => ({
      id: item.id,
      label: item.itemLabelTh,
      points: item.points,
      checked: checkedIds.has(item.id),
      isCritical: item.isCritical
    }))
  );
  const decisionErrors = submitMode === "submit" ? validateProposalDecision(decision, reason) : [];
  if (submitMode === "submit" && !overallComment) {
    decisionErrors.push("กรุณาระบุ comment เพื่อให้นักศึกษาเห็น feedback");
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
    rubric.items.map((item) =>
      prisma.scoreItem.upsert({
        where: { scoreSubmissionId_rubricItemId: { scoreSubmissionId: scoreSubmission.id, rubricItemId: item.id } },
        update: {
          checked: checkedIds.has(item.id),
          pointsAwarded: checkedIds.has(item.id) ? item.points : 0
        },
        create: {
          scoreSubmissionId: scoreSubmission.id,
          rubricItemId: item.id,
          checked: checkedIds.has(item.id),
          pointsAwarded: checkedIds.has(item.id) ? item.points : 0
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
        eventTitle: "อาจารย์ส่งคะแนน Proposal",
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
  if (existing && existing.items.length === progress1Criteria.length) return existing;

  const latest = await prisma.rubric.findFirst({ where: { roundType: "PROGRESS_1" }, orderBy: { version: "desc" } });
  return prisma.rubric.create({
    data: {
      roundType: "PROGRESS_1",
      name: "Progress 1 Rubric",
      version: (latest?.version ?? 0) + 1,
      active: true,
      items: {
        create: progress1Criteria.map((criterion) => ({
          groupKey: criterion.key,
          groupLabelTh: criterion.label,
          itemKey: criterion.key,
          itemLabelTh: criterion.label,
          points: criterion.max,
          displayOrder: criterion.order
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
  if (existing && existing.items.length === progress2Criteria.length) return existing;

  const latest = await prisma.rubric.findFirst({ where: { roundType: "PROGRESS_2" }, orderBy: { version: "desc" } });
  return prisma.rubric.create({
    data: {
      roundType: "PROGRESS_2",
      name: "Progress 2 Rubric",
      version: (latest?.version ?? 0) + 1,
      active: true,
      items: {
        create: progress2Criteria.map((criterion) => ({
          groupKey: criterion.key,
          groupLabelTh: criterion.label,
          itemKey: criterion.key,
          itemLabelTh: criterion.label,
          points: criterion.max,
          displayOrder: criterion.order
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
  if (existing && existing.items.length === finalCriteria.length) return existing;

  const latest = await prisma.rubric.findFirst({ where: { roundType: "FINAL_PRESENTATION" }, orderBy: { version: "desc" } });
  return prisma.rubric.create({
    data: {
      roundType: "FINAL_PRESENTATION",
      name: "Final Presentation Rubric",
      version: (latest?.version ?? 0) + 1,
      active: true,
      items: {
        create: finalCriteria.map((criterion) => ({
          groupKey: criterion.key,
          groupLabelTh: criterion.label,
          itemKey: criterion.key,
          itemLabelTh: criterion.label,
          points: criterion.max,
          displayOrder: criterion.order
        }))
      }
    },
    include: { items: { orderBy: { displayOrder: "asc" } } }
  });
}

export async function submitProgress1Score(formData: FormData) {
  const user = await requireTeacherUser();
  const timer = createActionTimer("teacher.submitProgress1Score");
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");
  const projectId = String(formData.get("project_id") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  const input: Progress1ScoreInput = {
    progress: Number(formData.get("progress")),
    problemSolving: Number(formData.get("problem_solving")),
    researchResults: Number(formData.get("research_results")),
    presentation: Number(formData.get("presentation")),
    overall: Number(formData.get("overall"))
  };
  const errors = validateProgress1Score(input);
  if (comment) errors.push(...validateMarkdownInput(comment, "Progress 1 comment"));
  if (errors.length) throw new Error(errors.join("\n"));

  const teacher = await timer.measure("load_teacher", () => prisma.teacher.findUniqueOrThrow({ where: { userId: user.id } }));
  const project = await timer.measure("load_project", () => prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { committeeAssignments: true }
  }));
  if (project.status !== "IN_PROGRESS") throw new Error("บันทึกคะแนน Progress 1 ได้เฉพาะโครงงานที่อยู่ในสถานะ IN_PROGRESS");
  const assigned = project.committeeAssignments.some(
    (assignment) => assignment.active && assignment.teacherId === teacher.id && ["HEAD", "MEMBER"].includes(assignment.role)
  );
  if (!assigned) throw new Error("เฉพาะ HEAD/MEMBER ที่ได้รับแต่งตั้งเท่านั้นที่บันทึกคะแนน Progress 1 ได้");

  const round = await timer.measure("load_round", () => prisma.assessmentRound.findUniqueOrThrow({
    where: { courseOfferingId_roundType: { courseOfferingId: project.courseOfferingId, roundType: "PROGRESS_1" } }
  }));
  const rubric = await timer.measure("ensure_rubric", () => ensureProgress1Rubric());
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
    update: { totalScore: totalProgress1Score(input), overallComment: comment || null, status: "SUBMITTED", submittedAt: new Date(), lockedAt: new Date() },
    create: { evaluatorAssignmentId: assignment.id, totalScore: totalProgress1Score(input), overallComment: comment || null, status: "SUBMITTED", submittedAt: new Date(), lockedAt: new Date() }
  });

  const valuesByKey: Record<string, number> = {
    progress: input.progress,
    problemSolving: input.problemSolving,
    researchResults: input.researchResults,
    presentation: input.presentation,
    overall: input.overall
  };
  await timer.measure("upsert_score_items", () => Promise.all(
    rubric.items.map((item) =>
      prisma.scoreItem.upsert({
        where: { scoreSubmissionId_rubricItemId: { scoreSubmissionId: scoreSubmission.id, rubricItemId: item.id } },
        update: { checked: valuesByKey[item.itemKey] > 0, pointsAwarded: valuesByKey[item.itemKey] ?? 0 },
        create: { scoreSubmissionId: scoreSubmission.id, rubricItemId: item.id, checked: valuesByKey[item.itemKey] > 0, pointsAwarded: valuesByKey[item.itemKey] ?? 0 }
      })
    )
  ));
  await timer.measure("create_timeline", () => prisma.projectTimelineEvent.create({
    data: {
      projectId: project.id,
      eventType: "PROGRESS_1_SCORE_SUBMITTED",
      eventTitle: "บันทึกคะแนน Progress 1",
      eventDescription: comment || null,
      actorUserId: user.id,
      relatedEntityType: "ScoreSubmission",
      relatedEntityId: scoreSubmission.id,
      metadataJson: { totalScore: totalProgress1Score(input) }
    }
  }));

  revalidatePath("/teacher/progress1");
  timer.end("redirect");
  redirect("/teacher/progress1?success=progress_1_score_saved");
}

export async function submitProgress2Score(formData: FormData) {
  const user = await requireTeacherUser();
  const timer = createActionTimer("teacher.submitProgress2Score");
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");
  const projectId = String(formData.get("project_id") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  const input: Progress2ScoreInput = {
    progress: Number(formData.get("progress")),
    problemSolving: Number(formData.get("problem_solving")),
    researchResults: Number(formData.get("research_results")),
    presentation: Number(formData.get("presentation")),
    overall: Number(formData.get("overall"))
  };
  const errors = validateProgress2Score(input);
  if (comment) errors.push(...validateMarkdownInput(comment, "Progress 2 comment"));
  if (errors.length) throw new Error(errors.join("\n"));

  const teacher = await timer.measure("load_teacher", () => prisma.teacher.findUniqueOrThrow({ where: { userId: user.id } }));
  const project = await timer.measure("load_project", () => prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { committeeAssignments: true }
  }));
  if (project.status !== "IN_PROGRESS") throw new Error("บันทึกคะแนน Progress 2 ได้เฉพาะโครงงานที่อยู่ในสถานะ IN_PROGRESS");
  const assigned = project.committeeAssignments.some(
    (assignment) => assignment.active && assignment.teacherId === teacher.id && ["HEAD", "MEMBER"].includes(assignment.role)
  );
  if (!assigned) throw new Error("เฉพาะ HEAD/MEMBER ที่ได้รับแต่งตั้งเท่านั้นที่บันทึกคะแนน Progress 2 ได้");

  const round = await timer.measure("load_round", () => prisma.assessmentRound.findUniqueOrThrow({
    where: { courseOfferingId_roundType: { courseOfferingId: project.courseOfferingId, roundType: "PROGRESS_2" } }
  }));
  const rubric = await timer.measure("ensure_rubric", () => ensureProgress2Rubric());
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
    update: { totalScore: totalProgress2Score(input), overallComment: comment || null, status: "SUBMITTED", submittedAt: new Date(), lockedAt: new Date() },
    create: { evaluatorAssignmentId: assignment.id, totalScore: totalProgress2Score(input), overallComment: comment || null, status: "SUBMITTED", submittedAt: new Date(), lockedAt: new Date() }
  });

  const valuesByKey: Record<string, number> = {
    progress: input.progress,
    problemSolving: input.problemSolving,
    researchResults: input.researchResults,
    presentation: input.presentation,
    overall: input.overall
  };
  await timer.measure("upsert_score_items", () => Promise.all(
    rubric.items.map((item) =>
      prisma.scoreItem.upsert({
        where: { scoreSubmissionId_rubricItemId: { scoreSubmissionId: scoreSubmission.id, rubricItemId: item.id } },
        update: { checked: valuesByKey[item.itemKey] > 0, pointsAwarded: valuesByKey[item.itemKey] ?? 0 },
        create: { scoreSubmissionId: scoreSubmission.id, rubricItemId: item.id, checked: valuesByKey[item.itemKey] > 0, pointsAwarded: valuesByKey[item.itemKey] ?? 0 }
      })
    )
  ));
  await timer.measure("create_timeline", () => prisma.projectTimelineEvent.create({
    data: {
      projectId: project.id,
      eventType: "PROGRESS_2_SCORE_SUBMITTED",
      eventTitle: "บันทึกคะแนน Progress 2",
      eventDescription: comment || null,
      actorUserId: user.id,
      relatedEntityType: "ScoreSubmission",
      relatedEntityId: scoreSubmission.id,
      metadataJson: { totalScore: totalProgress2Score(input) }
    }
  }));

  revalidatePath("/teacher/progress2");
  timer.end("redirect");
  redirect("/teacher/progress2?success=progress_2_score_saved");
}

export async function submitFinalPresentationScore(formData: FormData) {
  const user = await requireTeacherUser();
  const timer = createActionTimer("teacher.submitFinalPresentationScore");
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");
  const projectId = String(formData.get("project_id") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  const input: FinalScoreInput = {
    researchResults: Number(formData.get("research_results")),
    executionProblemSolving: Number(formData.get("execution_problem_solving")),
    presentation: Number(formData.get("presentation")),
    overall: Number(formData.get("overall"))
  };
  const errors = validateFinalScore(input);
  if (comment) errors.push(...validateMarkdownInput(comment, "Final Presentation comment"));
  if (errors.length) throw new Error(errors.join("\n"));

  const teacher = await timer.measure("load_teacher", () => prisma.teacher.findUniqueOrThrow({ where: { userId: user.id } }));
  const project = await timer.measure("load_project", () => prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { committeeAssignments: true }
  }));
  if (project.status !== "IN_PROGRESS") throw new Error("บันทึกคะแนน Final Presentation ได้เฉพาะโครงงานที่อยู่ในสถานะ IN_PROGRESS");
  const assigned = project.committeeAssignments.some(
    (assignment) => assignment.active && assignment.teacherId === teacher.id && ["HEAD", "MEMBER"].includes(assignment.role)
  );
  if (!assigned) throw new Error("เฉพาะ HEAD/MEMBER ที่ได้รับแต่งตั้งเท่านั้นที่บันทึกคะแนน Final Presentation ได้");

  const round = await timer.measure("load_round", () => prisma.assessmentRound.findUnique({
    where: { courseOfferingId_roundType: { courseOfferingId: project.courseOfferingId, roundType: "FINAL_PRESENTATION" } }
  }));
  if (!round) throw new Error("ยังไม่มีรอบ Final Presentation ระดับรายวิชา");

  const rubric = await timer.measure("ensure_rubric", () => ensureFinalRubric());
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
      totalScore: totalFinalNormalizedScore(input),
      overallComment: comment || null,
      status: "SUBMITTED",
      submittedAt: new Date(),
      lockedAt: new Date()
    },
    create: {
      evaluatorAssignmentId: assignment.id,
      totalScore: totalFinalNormalizedScore(input),
      overallComment: comment || null,
      status: "SUBMITTED",
      submittedAt: new Date(),
      lockedAt: new Date()
    }
  });

  const valuesByKey: Record<string, number> = {
    researchResults: input.researchResults,
    executionProblemSolving: input.executionProblemSolving,
    presentation: input.presentation,
    overall: input.overall
  };
  await timer.measure("upsert_score_items", () => Promise.all(
    rubric.items.map((item) =>
      prisma.scoreItem.upsert({
        where: { scoreSubmissionId_rubricItemId: { scoreSubmissionId: scoreSubmission.id, rubricItemId: item.id } },
        update: { checked: valuesByKey[item.itemKey] > 0, pointsAwarded: valuesByKey[item.itemKey] ?? 0 },
        create: { scoreSubmissionId: scoreSubmission.id, rubricItemId: item.id, checked: valuesByKey[item.itemKey] > 0, pointsAwarded: valuesByKey[item.itemKey] ?? 0 }
      })
    )
  ));
  await timer.measure("create_timeline", () => prisma.projectTimelineEvent.create({
    data: {
      projectId: project.id,
      eventType: "FINAL_PRESENTATION_SCORE_SUBMITTED",
      eventTitle: "บันทึกคะแนน Final Presentation",
      eventDescription: comment || null,
      actorUserId: user.id,
      relatedEntityType: "ScoreSubmission",
      relatedEntityId: scoreSubmission.id,
      metadataJson: { rawScore: totalFinalRawScore(input), normalizedScore: totalFinalNormalizedScore(input) }
    }
  }));

  revalidatePath("/teacher/final");
  timer.end("redirect");
  redirect("/teacher/final?success=final_score_saved");
}

export async function reviewReportVersion(formData: FormData) {
  const user = await requireTeacherUser();
  const timer = createActionTimer("teacher.reviewReportVersion");
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");
  const reportVersionId = String(formData.get("report_version_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  if (decision !== "PASS" && decision !== "FAIL") throw new Error("ผลการตรวจเล่มไม่ถูกต้อง");
  if (!comment) throw new Error("กรุณาระบุ comment สำหรับผลการตรวจเล่ม");
  const commentErrors = validateMarkdownInput(comment, "report review comment");
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
    throw new Error("ตรวจเล่มได้เฉพาะโครงงานที่อยู่ในสถานะ REPORT_REVIEW");
  }
  if (reportVersion.project.reportVersions[0]?.id !== reportVersion.id) {
    throw new Error("กรุณาตรวจเล่มรายงาน version ล่าสุดเท่านั้น");
  }
  if (
    !isAssignedReportReviewer({
      teacherId: teacher.id,
      committeeAssignments: reportVersion.project.committeeAssignments,
      advisorRequests: reportVersion.project.advisorRequests
    })
  ) {
    throw new Error("เฉพาะอาจารย์ที่ปรึกษาหรือ HEAD/MEMBER ที่ได้รับแต่งตั้งเท่านั้นที่ตรวจเล่มได้");
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

  const projectReviews = await prisma.reportReview.findMany({
    where: { reportVersion: { projectId: reportVersion.projectId } }
  });
  const requiredReviewerIds = requiredReportReviewerIds(reportVersion.project.committeeAssignments);
  const latestReviews = await prisma.reportReview.findMany({
    where: { reportVersionId: reportVersion.id }
  });
  const approved =
    !latestReportVersionHasRevisionRequest(latestReviews) &&
    allRequiredReportReviewersPassed({ requiredReviewerIds, reviews: projectReviews });

  await timer.measure("approval_transaction", () => prisma.$transaction(async (tx) => {
    await tx.projectTimelineEvent.create({
      data: {
        projectId: reportVersion.projectId,
        eventType: "REPORT_REVIEW_PASSED_BY_REVIEWER",
        eventTitle: "อาจารย์อนุมัติเล่มรายงาน",
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
          eventTitle: "เล่มรายงานผ่านครบตามกรรมการ",
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
  const timer = createActionTimer("teacher.submitAdvisorScore");
  if (!hasApprovedTeacherCapability(user) || !user.id) throw new Error("ต้องได้รับอนุมัติเป็นอาจารย์ก่อน");
  const projectId = String(formData.get("project_id") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  const input: AdvisorScoreInput = {
    responsibility: Number(formData.get("responsibility")),
    researchProcess: Number(formData.get("research_process")),
    problemSolving: Number(formData.get("problem_solving")),
    communication: Number(formData.get("communication")),
    professionalism: Number(formData.get("professionalism"))
  };
  const errors = validateAdvisorScore(input);
  if (comment) errors.push(...validateMarkdownInput(comment, "Advisor score comment"));
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
  if (!isAdvisor) throw new Error("เฉพาะอาจารย์ที่ปรึกษาของโครงงานเท่านั้นที่บันทึก Advisor score ได้");
  if (project.status !== "REPORT_APPROVED" && project.status !== "ADVISOR_SCORING") {
    throw new Error("Advisor score เปิดให้บันทึกได้หลังเล่มรายงานผ่านแล้วเท่านั้น");
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
        eventTitle: "บันทึกคะแนน Advisor 25%",
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
