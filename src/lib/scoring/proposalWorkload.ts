import type { Prisma } from "@prisma/client";
import { LATE_ROUND_EXCEPTION_TYPE, LATE_ROUND_EXCUSED_EXCEPTION_TYPE } from "@/lib/assessments/roundExceptions";

export function openProposalScoringAttemptWhere(): Prisma.AssessmentAttemptWhereInput {
  return {
    presentationSubmission: { status: { in: ["SUBMITTED", "LOCKED"] } },
    proposalResult: { is: null },
    OR: [
      { assessmentRound: { roundType: "PROPOSAL", status: "SCORING_OPEN" } },
      {
        assessmentRound: { roundType: "PROPOSAL" },
        project: {
          roundExceptions: {
            some: {
              status: "OPEN",
              exceptionType: { in: [LATE_ROUND_EXCEPTION_TYPE, LATE_ROUND_EXCUSED_EXCEPTION_TYPE] },
              assessmentRound: { roundType: "PROPOSAL" }
            }
          }
        }
      }
    ]
  };
}

export function pendingProposalScoringAttemptWhere(evaluatorUserId: string): Prisma.AssessmentAttemptWhereInput {
  return {
    AND: [
      openProposalScoringAttemptWhere(),
      {
        NOT: {
          evaluatorAssignments: {
            some: {
              evaluatorUserId,
              scoreSubmission: { is: { status: "SUBMITTED" } }
            }
          }
        }
      }
    ]
  };
}
