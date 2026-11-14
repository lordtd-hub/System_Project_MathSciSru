import type { Prisma } from "@prisma/client";

export const adminProposalVoteScope = (courseOfferingId: string): Prisma.ProposalVoteWhereInput => ({
  project: { courseOfferingId, status: { in: ["PROPOSAL_REVIEW", "PROPOSAL_ADMIN_DECISION"] } }
});
export const adminProposalDecisionScope = (courseOfferingId: string): Prisma.AssessmentAttemptWhereInput => ({
  project: { courseOfferingId },
  assessmentRound: { roundType: "PROPOSAL" },
  proposalResult: null,
  evaluatorAssignments: { some: { status: "SUBMITTED", scoreSubmission: { status: "SUBMITTED" } } }
});
export const adminNotificationScope = (courseOfferingId: string): Prisma.NotificationWhereInput => ({
  status: "UNREAD",
  OR: [{ projectId: null }, { project: { courseOfferingId } }]
});
