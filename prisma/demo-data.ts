import type { PrismaClient } from "@prisma/client";

export const e2eCourseOfferingId = "e2e-lifecycle-course-offering";
export const demoStudentCodes = ["65123456789", "65123456790", "65123456791"];

export function assertLocalDatabase(databaseUrl = process.env.DATABASE_URL ?? "") {
  if (!databaseUrl.includes("localhost") && !databaseUrl.includes("127.0.0.1")) {
    throw new Error("DATABASE_URL is not local; refusing to clean demo/E2E data");
  }
}

export async function cleanKnownDemoData(prisma: PrismaClient) {
  assertLocalDatabase();

  const e2eOfferings = await prisma.courseOffering.findMany({
    where: {
      OR: [
        { id: e2eCourseOfferingId },
        { id: { startsWith: "e2e-offering-" } },
        { id: { endsWith: "-demo" } }
      ]
    },
    select: { id: true }
  });
  const e2eOfferingIds = e2eOfferings.map((offering) => offering.id);
  const demoStudents = await prisma.student.findMany({
    where: { studentCode: { in: demoStudentCodes } },
    select: { id: true }
  });
  const demoStudentIds = demoStudents.map((student) => student.id);

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { courseOfferingId: { in: e2eOfferingIds } },
        { courseOfferingId: { endsWith: "-demo" }, studentId: { in: demoStudentIds } }
      ]
    },
    select: { id: true }
  });
  const projectIds = projects.map((project) => project.id);

  const rounds = await prisma.assessmentRound.findMany({
    where: { courseOfferingId: { in: e2eOfferingIds } },
    select: { id: true }
  });
  const roundIds = rounds.map((round) => round.id);

  const attempts = await prisma.assessmentAttempt.findMany({
    where: { OR: [{ projectId: { in: projectIds } }, { assessmentRoundId: { in: roundIds } }] },
    select: { id: true }
  });
  const attemptIds = attempts.map((attempt) => attempt.id);

  const submissions = await prisma.presentationSubmission.findMany({
    where: { OR: [{ projectId: { in: projectIds } }, { assessmentAttemptId: { in: attemptIds } }] },
    select: { id: true }
  });
  const submissionIds = submissions.map((submission) => submission.id);

  const origins = await prisma.projectOrigin.findMany({
    where: { projectId: { in: projectIds } },
    select: { id: true }
  });
  const originIds = origins.map((origin) => origin.id);

  const assignments = await prisma.evaluatorAssignment.findMany({
    where: { assessmentAttemptId: { in: attemptIds } },
    select: { id: true }
  });
  const assignmentIds = assignments.map((assignment) => assignment.id);

  const scoreSubmissions = await prisma.scoreSubmission.findMany({
    where: { evaluatorAssignmentId: { in: assignmentIds } },
    select: { id: true }
  });
  const scoreSubmissionIds = scoreSubmissions.map((score) => score.id);

  const schedules = await prisma.examScheduleProposal.findMany({
    where: { projectId: { in: projectIds } },
    select: { id: true }
  });
  const scheduleIds = schedules.map((schedule) => schedule.id);

  const reportVersions = await prisma.reportVersion.findMany({
    where: { projectId: { in: projectIds } },
    select: { id: true }
  });
  const reportVersionIds = reportVersions.map((version) => version.id);

  await prisma.$transaction([
    prisma.scoreItem.deleteMany({ where: { scoreSubmissionId: { in: scoreSubmissionIds } } }),
    prisma.proposalEvaluatorDecision.deleteMany({ where: { scoreSubmissionId: { in: scoreSubmissionIds } } }),
    prisma.scoreSubmission.deleteMany({ where: { id: { in: scoreSubmissionIds } } }),
    prisma.proposalVote.deleteMany({ where: { OR: [{ projectId: { in: projectIds } }, { assessmentAttemptId: { in: attemptIds } }] } }),
    prisma.evaluatorAssignment.deleteMany({ where: { id: { in: assignmentIds } } }),
    prisma.scoreRelease.deleteMany({ where: { OR: [{ projectId: { in: projectIds } }, { assessmentAttemptId: { in: attemptIds } }] } }),
    prisma.projectProposalResult.deleteMany({ where: { OR: [{ projectId: { in: projectIds } }, { assessmentAttemptId: { in: attemptIds } }] } }),
    prisma.presentationSubmissionVersion.deleteMany({ where: { presentationSubmissionId: { in: submissionIds } } }),
    prisma.presentationSubmission.deleteMany({ where: { id: { in: submissionIds } } }),
    prisma.projectOriginVersion.deleteMany({ where: { projectOriginId: { in: originIds } } }),
    prisma.projectOrigin.deleteMany({ where: { id: { in: originIds } } }),
    prisma.examScheduleApproval.deleteMany({ where: { scheduleProposalId: { in: scheduleIds } } }),
    prisma.examScheduleProposal.deleteMany({ where: { id: { in: scheduleIds } } }),
    prisma.assessmentSubmission.deleteMany({ where: { projectId: { in: projectIds } } }),
    prisma.reportReview.deleteMany({ where: { reportVersionId: { in: reportVersionIds } } }),
    prisma.reportVersion.deleteMany({ where: { id: { in: reportVersionIds } } }),
    prisma.advisorScore.deleteMany({ where: { projectId: { in: projectIds } } }),
    prisma.projectRoundException.deleteMany({ where: { OR: [{ projectId: { in: projectIds } }, { assessmentRoundId: { in: roundIds } }] } }),
    prisma.committeeAssignment.deleteMany({ where: { projectId: { in: projectIds } } }),
    prisma.advisorRequest.deleteMany({ where: { projectId: { in: projectIds } } }),
    prisma.notification.deleteMany({ where: { projectId: { in: projectIds } } }),
    prisma.projectTimelineEvent.deleteMany({ where: { projectId: { in: projectIds } } }),
    prisma.projectStatusHistory.deleteMany({ where: { projectId: { in: projectIds } } }),
    prisma.assessmentAttempt.deleteMany({ where: { id: { in: attemptIds } } }),
    prisma.project.deleteMany({ where: { id: { in: projectIds } } }),
    prisma.assessmentRound.deleteMany({ where: { id: { in: roundIds } } }),
    prisma.courseOffering.deleteMany({ where: { id: { in: e2eOfferingIds } } })
  ]);

  return {
    courseOfferingsDeleted: e2eOfferingIds.length,
    projectsDeleted: projectIds.length,
    roundsDeleted: roundIds.length
  };
}
