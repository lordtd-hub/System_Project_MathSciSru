import type { PrismaClient } from "@prisma/client";

export type TestCourseResetSummary = {
  courseOfferingId: string;
  deletedProjects: number;
  deletedStudents: number;
  deletedRounds: number;
};

export async function resetCourseOfferingForTesting(db: PrismaClient, courseOfferingId: string, adminUserId: string): Promise<TestCourseResetSummary> {
  return db.$transaction(async (tx) => {
    const offering = await tx.courseOffering.findUniqueOrThrow({
      where: { id: courseOfferingId },
      include: {
        projects: { select: { id: true, studentId: true } },
        assessmentRounds: { select: { id: true } }
      }
    });

    const projectIds = offering.projects.map((project) => project.id);
    const studentIds = [...new Set(offering.projects.map((project) => project.studentId))];
    const roundIds = offering.assessmentRounds.map((round) => round.id);

    const isolatedStudents = studentIds.length
      ? await tx.student.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, projects: { select: { courseOfferingId: true } } }
        })
      : [];
    const isolatedStudentIds = isolatedStudents.filter((student) => student.projects.every((project) => project.courseOfferingId === courseOfferingId)).map((student) => student.id);

    const attempts = await tx.assessmentAttempt.findMany({
      where: { OR: [{ projectId: { in: projectIds } }, { assessmentRoundId: { in: roundIds } }] },
      select: { id: true }
    });
    const attemptIds = attempts.map((attempt) => attempt.id);

    const assignments = await tx.evaluatorAssignment.findMany({
      where: { assessmentAttemptId: { in: attemptIds } },
      select: { id: true }
    });
    const assignmentIds = assignments.map((assignment) => assignment.id);

    const scoreSubmissions = await tx.scoreSubmission.findMany({
      where: { evaluatorAssignmentId: { in: assignmentIds } },
      select: { id: true }
    });
    const scoreSubmissionIds = scoreSubmissions.map((score) => score.id);

    const presentationSubmissions = await tx.presentationSubmission.findMany({
      where: { OR: [{ projectId: { in: projectIds } }, { assessmentAttemptId: { in: attemptIds } }] },
      select: { id: true }
    });
    const presentationSubmissionIds = presentationSubmissions.map((submission) => submission.id);

    const projectOrigins = await tx.projectOrigin.findMany({
      where: { projectId: { in: projectIds } },
      select: { id: true }
    });
    const projectOriginIds = projectOrigins.map((origin) => origin.id);

    const scheduleProposals = await tx.examScheduleProposal.findMany({
      where: { OR: [{ projectId: { in: projectIds } }, { assessmentRoundId: { in: roundIds } }, { courseOfferingId }] },
      select: { id: true }
    });
    const scheduleProposalIds = scheduleProposals.map((schedule) => schedule.id);

    const reportVersions = await tx.reportVersion.findMany({
      where: { projectId: { in: projectIds } },
      select: { id: true }
    });
    const reportVersionIds = reportVersions.map((version) => version.id);

    await tx.scoreItem.deleteMany({ where: { scoreSubmissionId: { in: scoreSubmissionIds } } });
    await tx.proposalEvaluatorDecision.deleteMany({ where: { scoreSubmissionId: { in: scoreSubmissionIds } } });
    await tx.scoreSubmission.deleteMany({ where: { id: { in: scoreSubmissionIds } } });
    await tx.proposalVote.deleteMany({ where: { OR: [{ projectId: { in: projectIds } }, { assessmentAttemptId: { in: attemptIds } }] } });
    await tx.evaluatorAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
    await tx.scoreRelease.deleteMany({ where: { OR: [{ projectId: { in: projectIds } }, { assessmentAttemptId: { in: attemptIds } }] } });
    await tx.projectProposalResult.deleteMany({ where: { OR: [{ projectId: { in: projectIds } }, { assessmentAttemptId: { in: attemptIds } }] } });
    await tx.presentationSubmissionVersion.deleteMany({ where: { presentationSubmissionId: { in: presentationSubmissionIds } } });
    await tx.presentationSubmission.deleteMany({ where: { id: { in: presentationSubmissionIds } } });
    await tx.projectOriginVersion.deleteMany({ where: { projectOriginId: { in: projectOriginIds } } });
    await tx.projectOrigin.deleteMany({ where: { id: { in: projectOriginIds } } });
    await tx.examScheduleApproval.deleteMany({ where: { scheduleProposalId: { in: scheduleProposalIds } } });
    await tx.examScheduleProposal.deleteMany({ where: { id: { in: scheduleProposalIds } } });
    await tx.assessmentSubmission.deleteMany({ where: { projectId: { in: projectIds } } });
    await tx.reportReview.deleteMany({ where: { reportVersionId: { in: reportVersionIds } } });
    await tx.reportVersion.deleteMany({ where: { id: { in: reportVersionIds } } });
    await tx.advisorScore.deleteMany({ where: { projectId: { in: projectIds } } });
    await tx.projectRoundException.deleteMany({ where: { OR: [{ projectId: { in: projectIds } }, { assessmentRoundId: { in: roundIds } }] } });
    await tx.committeeAssignment.deleteMany({ where: { projectId: { in: projectIds } } });
    await tx.advisorRequest.deleteMany({ where: { projectId: { in: projectIds } } });
    await tx.notification.deleteMany({ where: { projectId: { in: projectIds } } });
    await tx.projectTimelineEvent.deleteMany({ where: { projectId: { in: projectIds } } });
    await tx.projectStatusHistory.deleteMany({ where: { projectId: { in: projectIds } } });
    await tx.assessmentAttempt.deleteMany({ where: { id: { in: attemptIds } } });
    await tx.project.deleteMany({ where: { id: { in: projectIds } } });
    await tx.assessmentRound.deleteMany({ where: { id: { in: roundIds } } });
    await tx.courseOffering.delete({ where: { id: courseOfferingId } });
    await tx.studentProfile.deleteMany({ where: { studentId: { in: isolatedStudentIds } } });
    await tx.student.deleteMany({ where: { id: { in: isolatedStudentIds } } });

    await tx.auditLog.create({
      data: {
        actorUserId: adminUserId,
        action: "TEST_COURSE_OFFERING_RESET",
        entityType: "CourseOffering",
        entityId: courseOfferingId,
        beforeJson: { projectCount: projectIds.length, roundCount: roundIds.length, studentCount: isolatedStudentIds.length },
        afterJson: { deleted: true }
      }
    });

    return {
      courseOfferingId,
      deletedProjects: projectIds.length,
      deletedStudents: isolatedStudentIds.length,
      deletedRounds: roundIds.length
    };
  });
}
