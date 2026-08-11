import type { AssessmentRoundType, AttemptType, ProjectStatus } from "@prisma/client";
import { isPresentationAssessmentComplete } from "@/lib/assessments/presentationCompletion";
import { applyLatePenalty, requiresLateRoundPenalty } from "@/lib/assessments/roundExceptions";
import { prisma } from "@/lib/db";
import { isPresentationScoreEditable } from "./scoreEditability";
import {
  normalizeTeacherScoreSnapshot,
  readTeacherScoreSnapshot,
  teacherScoreSnapshotsEqual,
  type TeacherScoreSnapshot
} from "./scoreSnapshots";
import { retryScoreTransaction } from "./transactionRetry";

export class ScorePersistenceConflict extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ScorePersistenceConflict";
  }
}

type PersistedRubricItem = {
  id: string;
  itemKey: string;
  checked: boolean;
  pointsAwarded: number;
  conditionCount?: number;
};

type PersistPresentationScoreInput = {
  requestId: string;
  actorUserId: string;
  teacherId: string;
  evaluatorDisplayName: string;
  projectId: string;
  assessmentRoundId: string;
  roundType: AssessmentRoundType;
  attemptType: AttemptType;
  assessmentKind: "PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENT";
  allowedProjectStatuses: ProjectStatus[];
  rawTotalScore: number;
  overallComment: string | null;
  items: PersistedRubricItem[];
  eventType: string;
  createEventTitle: string;
  updateEventTitle: string;
  auditAction: string;
  completeFinalWhenReady?: boolean;
};

function snapshotFromSubmission(submission: {
  totalScore: unknown;
  overallComment: string | null;
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
    items: submission.scoreItems.map((item) => ({
      rubricItemId: item.rubricItemId,
      itemKey: item.rubricItem.itemKey,
      checked: item.checked,
      pointsAwarded: item.pointsAwarded,
      comment: item.comment
    }))
  });
}

export async function persistPresentationScore(input: PersistPresentationScoreInput) {
  return retryScoreTransaction(() => prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5000ms'");
    await tx.$queryRaw`SELECT id FROM "projects" WHERE id = ${input.projectId} FOR UPDATE`;

    const [project, round, roundExceptions, confirmedSchedule] = await Promise.all([
      tx.project.findUnique({
        where: { id: input.projectId },
        include: { committeeAssignments: true }
      }),
      tx.assessmentRound.findUnique({ where: { id: input.assessmentRoundId } }),
      tx.projectRoundException.findMany({
        where: { projectId: input.projectId, assessmentRoundId: input.assessmentRoundId, status: "OPEN" },
        select: { exceptionType: true, status: true }
      }),
      tx.examScheduleProposal.findFirst({
        where: { projectId: input.projectId, assessmentKind: input.assessmentKind, status: "CONFIRMED" },
        select: { id: true }
      })
    ]);

    if (!project || !round || round.roundType !== input.roundType) throw new ScorePersistenceConflict("score_context_missing");
    if (!input.allowedProjectStatuses.includes(project.status)) throw new ScorePersistenceConflict("score_project_state_changed");
    if (!confirmedSchedule) throw new ScorePersistenceConflict("score_schedule_not_confirmed");
    if (!project.committeeAssignments.some(
      (assignment) => assignment.active
        && assignment.teacherId === input.teacherId
        && (assignment.role === "HEAD" || assignment.role === "MEMBER")
    )) throw new ScorePersistenceConflict("score_evaluator_not_eligible");
    if (!isPresentationScoreEditable({ roundStatus: round.status, roundExceptions })) {
      throw new ScorePersistenceConflict("score_editing_closed");
    }

    const latePenaltyRequired = requiresLateRoundPenalty(roundExceptions);
    const totalScore = latePenaltyRequired ? applyLatePenalty(input.rawTotalScore) : input.rawTotalScore;
    const attempt = await tx.assessmentAttempt.upsert({
      where: {
        projectId_assessmentRoundId_attemptNo: {
          projectId: input.projectId,
          assessmentRoundId: input.assessmentRoundId,
          attemptNo: 1
        }
      },
      update: { status: "SCORING_OPEN", attemptType: input.attemptType },
      create: {
        projectId: input.projectId,
        assessmentRoundId: input.assessmentRoundId,
        attemptNo: 1,
        attemptType: input.attemptType,
        status: "SCORING_OPEN"
      }
    });
    const assignment = await tx.evaluatorAssignment.upsert({
      where: { assessmentAttemptId_evaluatorUserId: { assessmentAttemptId: attempt.id, evaluatorUserId: input.actorUserId } },
      update: {
        teacherId: input.teacherId,
        evaluatorDisplayNameSnapshot: input.evaluatorDisplayName
      },
      create: {
        assessmentAttemptId: attempt.id,
        evaluatorUserId: input.actorUserId,
        teacherId: input.teacherId,
        evaluatorDisplayNameSnapshot: input.evaluatorDisplayName,
        status: "ASSIGNED",
        isRequired: true
      }
    });
    await tx.$queryRaw`SELECT id FROM "evaluator_assignments" WHERE id = ${assignment.id} FOR UPDATE`;

    const previousSubmission = await tx.scoreSubmission.findUnique({
      where: { evaluatorAssignmentId: assignment.id },
      include: { scoreItems: { include: { rubricItem: { select: { itemKey: true } } } } }
    });
    const previousAudit = previousSubmission
      ? await tx.auditLog.findFirst({
          where: { entityType: "ScoreSubmission", entityId: previousSubmission.id },
          orderBy: { occurredAt: "desc" },
          select: { afterJson: true }
        })
      : null;
    const beforeSnapshot = readTeacherScoreSnapshot(previousAudit?.afterJson)
      ?? (previousSubmission ? snapshotFromSubmission(previousSubmission) : null);
    const afterSnapshot = normalizeTeacherScoreSnapshot({
      totalScore,
      overallComment: input.overallComment,
      items: input.items.map((item) => ({
        rubricItemId: item.id,
        itemKey: item.itemKey,
        checked: item.checked,
        pointsAwarded: item.pointsAwarded,
        ...(item.conditionCount === undefined ? {} : { conditionCount: item.conditionCount })
      }))
    });

    if (previousSubmission?.status === "SUBMITTED" && teacherScoreSnapshotsEqual(beforeSnapshot, afterSnapshot)) {
      return {
        unchanged: true,
        isRevision: true,
        scoreSubmissionId: previousSubmission.id,
        attemptId: attempt.id,
        totalScore
      };
    }

    const now = new Date();
    const scoreSubmission = await tx.scoreSubmission.upsert({
      where: { evaluatorAssignmentId: assignment.id },
      update: {
        totalScore,
        overallComment: input.overallComment,
        status: "SUBMITTED",
        submittedAt: now,
        lockedAt: now
      },
      create: {
        evaluatorAssignmentId: assignment.id,
        totalScore,
        overallComment: input.overallComment,
        status: "SUBMITTED",
        submittedAt: now,
        lockedAt: now
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
    await tx.evaluatorAssignment.update({ where: { id: assignment.id }, data: { status: "SUBMITTED" } });

    const isRevision = Boolean(previousSubmission);
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.auditAction,
        entityType: "ScoreSubmission",
        entityId: scoreSubmission.id,
        beforeJson: beforeSnapshot ?? undefined,
        afterJson: afterSnapshot,
        metadataJson: {
          requestId: input.requestId,
          projectId: input.projectId,
          assessmentRoundId: input.assessmentRoundId,
          assessmentAttemptId: attempt.id,
          isRevision,
          latePenaltyRequired,
          latePenaltyPercent: latePenaltyRequired ? 10 : 0,
          rawTotalScore: input.rawTotalScore
        }
      }
    });
    await tx.projectTimelineEvent.create({
      data: {
        projectId: input.projectId,
        eventType: input.eventType,
        eventTitle: isRevision ? input.updateEventTitle : input.createEventTitle,
        eventDescription: input.overallComment,
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
          requestId: input.requestId
        }
      }
    });

    if (input.completeFinalWhenReady) {
      const completionEvidence = await tx.evaluatorAssignment.findMany({
        where: { assessmentAttemptId: attempt.id },
        select: { teacherId: true, scoreSubmission: { select: { status: true } } }
      });
      const finalComplete = isPresentationAssessmentComplete({
        roundStatus: round.status,
        committeeAssignments: project.committeeAssignments,
        scoreSubmissions: completionEvidence.map((row) => ({
          teacherId: row.teacherId,
          status: row.scoreSubmission?.status ?? null
        }))
      });
      if (finalComplete && project.status === "IN_PROGRESS") {
        await tx.project.update({ where: { id: project.id }, data: { status: "FINAL_DONE" } });
        await tx.projectStatusHistory.create({
          data: {
            projectId: project.id,
            fromStatus: "IN_PROGRESS",
            toStatus: "FINAL_DONE",
            reason: "FINAL_PRESENTATION_SCORES_COMPLETED",
            actorUserId: input.actorUserId,
            metadataJson: { assessmentRoundId: round.id, assessmentAttemptId: attempt.id, requestId: input.requestId }
          }
        });
        await tx.projectTimelineEvent.create({
          data: {
            projectId: project.id,
            eventType: "FINAL_PRESENTATION_DONE",
            eventTitle: "การสอบนำเสนอขั้นสุดท้ายเสร็จสิ้น",
            eventDescription: "กรรมการบันทึกคะแนนครบตามคณะกรรมการแล้ว นักศึกษาสามารถส่งรายงานฉบับสมบูรณ์ได้",
            actorUserId: input.actorUserId,
            relatedEntityType: "AssessmentAttempt",
            relatedEntityId: attempt.id,
            metadataJson: { requestId: input.requestId }
          }
        });
      }
    }

    return { unchanged: false, isRevision, scoreSubmissionId: scoreSubmission.id, attemptId: attempt.id, totalScore };
  }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 15_000 }));
}
