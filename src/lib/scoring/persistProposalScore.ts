import { applyLatePenalty, requiresLateRoundPenalty } from "@/lib/assessments/roundExceptions";
import { prisma } from "@/lib/db";
import { isProposalScoreEditable } from "./scoreEditability";
import { PROPOSAL_DRAFT_V2_AUDIT_ACTION } from "./proposalDraftIntegrity";
import { ScorePersistenceConflict } from "./persistPresentationScore";
import {
  normalizeTeacherScoreSnapshot,
  readTeacherScoreSnapshot,
  teacherScoreSnapshotsEqual,
  type TeacherScoreSnapshot
} from "./scoreSnapshots";
import { retryScoreTransaction } from "./transactionRetry";
import { canScoreProposalAttempt } from "./proposalAttemptAccess";

type ProposalRubricItem = {
  id: string;
  itemKey: string;
  checked: boolean;
  pointsAwarded: number;
  conditionCount?: number;
  isCritical: boolean;
  itemLabelTh: string;
};

type PersistProposalScoreInput = {
  requestId: string;
  actorUserId: string;
  assignmentId: string;
  submit: boolean;
  decision: "PASS" | "PASS_WITH_REVISION" | "NOT_PASS" | null;
  reason: string;
  overallComment: string;
  rawTotalScore: number;
  items: ProposalRubricItem[];
};

function databaseSnapshot(submission: {
  totalScore: unknown;
  overallComment: string | null;
  proposalDecision: { decision: string; reason: string | null } | null;
  scoreItems: Array<{
    rubricItemId: string;
    checked: boolean;
    pointsAwarded: number;
    comment: string | null;
    rubricItem: { itemKey: string };
  }>;
}): TeacherScoreSnapshot {
  return normalizeTeacherScoreSnapshot({
    totalScore: Number(submission.totalScore),
    overallComment: submission.overallComment,
    decision: submission.proposalDecision?.decision ?? null,
    reason: submission.proposalDecision?.reason ?? null,
    items: submission.scoreItems.map((item) => ({
      rubricItemId: item.rubricItemId,
      itemKey: item.rubricItem.itemKey,
      checked: item.checked,
      pointsAwarded: item.pointsAwarded,
      comment: item.comment
    }))
  });
}

export async function persistProposalScore(input: PersistProposalScoreInput) {
  return retryScoreTransaction(() => prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5000ms'");
    const context = await tx.evaluatorAssignment.findUnique({
      where: { id: input.assignmentId },
      select: { assessmentAttempt: { select: { projectId: true } } }
    });
    if (!context) throw new ScorePersistenceConflict("score_context_missing");
    await tx.$queryRaw`SELECT id FROM "projects" WHERE id = ${context.assessmentAttempt.projectId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "evaluator_assignments" WHERE id = ${input.assignmentId} FOR UPDATE`;

    const assignment = await tx.evaluatorAssignment.findUnique({
      where: { id: input.assignmentId },
      include: {
        teacher: { select: { active: true, isInternal: true, canEvaluateProposal: true } },
        assessmentAttempt: { include: { assessmentRound: true, proposalResult: true, project: { select: { status: true } } } },
        scoreSubmission: {
          include: {
            proposalDecision: true,
            scoreItems: { include: { rubricItem: { select: { itemKey: true } } } }
          }
        }
      }
    });
    if (
      !assignment
      || assignment.evaluatorUserId !== input.actorUserId
      || !assignment.teacherId
      || !assignment.teacher?.active
      || !assignment.teacher.isInternal
      || !assignment.teacher.canEvaluateProposal
    ) {
      throw new ScorePersistenceConflict("score_evaluator_not_eligible");
    }
    if (assignment.assessmentAttempt.proposalResult) throw new ScorePersistenceConflict("proposal_decision_already_saved");
    const latestProposalAttempt = await tx.assessmentAttempt.findFirst({
      where: {
        projectId: assignment.assessmentAttempt.projectId,
        assessmentRoundId: assignment.assessmentAttempt.assessmentRoundId
      },
      orderBy: { attemptNo: "desc" },
      select: { id: true }
    });
    const isReproposal = assignment.assessmentAttempt.attemptType === "REPROPOSAL";
    const roundExceptions = isReproposal ? [] : await tx.projectRoundException.findMany({
      where: {
        projectId: assignment.assessmentAttempt.projectId,
        assessmentRoundId: assignment.assessmentAttempt.assessmentRoundId,
        status: "OPEN"
      },
      select: { exceptionType: true, status: true }
    });
    const canScore = canScoreProposalAttempt({
      attemptType: assignment.assessmentAttempt.attemptType,
      attemptStatus: assignment.assessmentAttempt.status,
      projectStatus: assignment.assessmentAttempt.project.status,
      roundType: assignment.assessmentAttempt.assessmentRound.roundType,
      roundStatus: assignment.assessmentAttempt.assessmentRound.status,
      hasProposalResult: false,
      isLatestProposalAttempt: latestProposalAttempt?.id === assignment.assessmentAttempt.id,
      hasOpenLateRoundException: isProposalScoreEditable({
        roundStatus: assignment.assessmentAttempt.assessmentRound.status,
        hasAdminDecision: false,
        roundExceptions
      })
    });
    if (!canScore) throw new ScorePersistenceConflict("proposal_round_not_open");

    const latePenaltyRequired = requiresLateRoundPenalty(roundExceptions);
    const totalScore = latePenaltyRequired ? applyLatePenalty(input.rawTotalScore) : input.rawTotalScore;
    const previousAudit = assignment.scoreSubmission
      ? await tx.auditLog.findFirst({
          where: { entityType: "ScoreSubmission", entityId: assignment.scoreSubmission.id },
          orderBy: { occurredAt: "desc" },
          select: { afterJson: true }
        })
      : null;
    const beforeSnapshot = readTeacherScoreSnapshot(previousAudit?.afterJson)
      ?? (assignment.scoreSubmission ? databaseSnapshot(assignment.scoreSubmission) : null);
    const conditionCounts = Object.fromEntries(
      input.items
        .filter((item) => item.conditionCount !== undefined)
        .map((item) => [item.id, item.conditionCount as number])
    );
    const afterSnapshot = normalizeTeacherScoreSnapshot({
      totalScore,
      overallComment: input.overallComment,
      decision: input.decision,
      reason: input.reason,
      items: input.items.map((item) => ({
        rubricItemId: item.id,
        itemKey: item.itemKey,
        checked: item.checked,
        pointsAwarded: item.pointsAwarded,
        ...(item.conditionCount === undefined ? {} : { conditionCount: item.conditionCount })
      }))
    });
    const desiredStatus = input.submit ? "SUBMITTED" : "DRAFT";
    if (assignment.scoreSubmission?.status === desiredStatus && teacherScoreSnapshotsEqual(beforeSnapshot, afterSnapshot)) {
      return {
        unchanged: true,
        isRevision: assignment.scoreSubmission.status === "SUBMITTED",
        scoreSubmissionId: assignment.scoreSubmission.id
      };
    }

    const now = new Date();
    const scoreSubmission = await tx.scoreSubmission.upsert({
      where: { evaluatorAssignmentId: assignment.id },
      update: {
        totalScore,
        overallComment: input.overallComment || null,
        status: desiredStatus,
        submittedAt: input.submit ? now : null,
        lockedAt: input.submit ? now : null
      },
      create: {
        evaluatorAssignmentId: assignment.id,
        totalScore,
        overallComment: input.overallComment || null,
        status: desiredStatus,
        submittedAt: input.submit ? now : null,
        lockedAt: input.submit ? now : null
      }
    });
    await tx.scoreItem.deleteMany({
      where: {
        scoreSubmissionId: scoreSubmission.id,
        rubricItemId: { notIn: input.items.map((item) => item.id) }
      }
    });
    await Promise.all(input.items.map((item) => tx.scoreItem.upsert({
      where: { scoreSubmissionId_rubricItemId: { scoreSubmissionId: scoreSubmission.id, rubricItemId: item.id } },
      update: { checked: item.checked, pointsAwarded: item.pointsAwarded },
      create: {
        scoreSubmissionId: scoreSubmission.id,
        rubricItemId: item.id,
        checked: item.checked,
        pointsAwarded: item.pointsAwarded
      }
    })));
    if (input.decision) {
      await tx.proposalEvaluatorDecision.upsert({
        where: { scoreSubmissionId: scoreSubmission.id },
        update: { decision: input.decision, reason: input.reason || null },
        create: { scoreSubmissionId: scoreSubmission.id, decision: input.decision, reason: input.reason || null }
      });
    } else {
      await tx.proposalEvaluatorDecision.deleteMany({ where: { scoreSubmissionId: scoreSubmission.id } });
    }

    const afterJson = { ...afterSnapshot, conditionCounts };
    if (!input.submit) {
      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: PROPOSAL_DRAFT_V2_AUDIT_ACTION,
          entityType: "ScoreSubmission",
          entityId: scoreSubmission.id,
          beforeJson: beforeSnapshot ?? undefined,
          afterJson,
          metadataJson: { requestId: input.requestId, assignmentId: assignment.id }
        }
      });
      return { unchanged: false, isRevision: false, scoreSubmissionId: scoreSubmission.id };
    }

    const isRevision = assignment.scoreSubmission?.status === "SUBMITTED" || assignment.status === "SUBMITTED";
    await tx.proposalVote.upsert({
      where: {
        projectId_teacherId_assessmentAttemptId: {
          projectId: assignment.assessmentAttempt.projectId,
          teacherId: assignment.teacherId,
          assessmentAttemptId: assignment.assessmentAttemptId
        }
      },
      update: {
        vote: input.decision === "PASS" ? "PASS" : input.decision === "PASS_WITH_REVISION" ? "REVISE" : "FAIL",
        comment: input.overallComment || input.reason || null,
        visibleToStudent: true,
        submittedAt: now
      },
      create: {
        projectId: assignment.assessmentAttempt.projectId,
        assessmentAttemptId: assignment.assessmentAttemptId,
        teacherId: assignment.teacherId,
        vote: input.decision === "PASS" ? "PASS" : input.decision === "PASS_WITH_REVISION" ? "REVISE" : "FAIL",
        comment: input.overallComment || input.reason || null,
        visibleToStudent: true,
        submittedAt: now
      }
    });
    await tx.evaluatorAssignment.update({ where: { id: assignment.id }, data: { status: "SUBMITTED" } });
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
            actorUserId: input.actorUserId,
            metadataJson: { requestId: input.requestId }
          }
        });
      }
    }
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: isRevision ? "PROPOSAL_SCORE_UPDATED" : "PROPOSAL_SCORE_SUBMITTED",
        entityType: "ScoreSubmission",
        entityId: scoreSubmission.id,
        beforeJson: beforeSnapshot ?? undefined,
        afterJson,
        metadataJson: {
          requestId: input.requestId,
          assignmentId: assignment.id,
          assessmentAttemptId: assignment.assessmentAttemptId,
          isRevision,
          rawTotalScore: input.rawTotalScore,
          latePenaltyRequired,
          latePenaltyPercent: latePenaltyRequired ? 10 : 0
        }
      }
    });
    await tx.projectTimelineEvent.create({
      data: {
        projectId: assignment.assessmentAttempt.projectId,
        eventType: "TEACHER_SCORE_SUBMITTED",
        eventTitle: isRevision ? "อาจารย์แก้ไขคะแนนการเสนอหัวข้อ" : "อาจารย์ส่งคะแนนการเสนอหัวข้อ",
        actorUserId: input.actorUserId,
        relatedEntityType: "ScoreSubmission",
        relatedEntityId: scoreSubmission.id,
        metadataJson: {
          totalScore,
          rawTotalScore: input.rawTotalScore,
          latePenaltyRequired,
          latePenaltyPercent: latePenaltyRequired ? 10 : 0,
          isRevision,
          previousTotalScore: beforeSnapshot?.totalScore ?? null,
          criticalWarnings: input.items.filter((item) => item.isCritical && item.pointsAwarded === 0).map((item) => item.itemLabelTh),
          requestId: input.requestId
        }
      }
    });
    return { unchanged: false, isRevision, scoreSubmissionId: scoreSubmission.id };
  }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 15_000 }));
}
