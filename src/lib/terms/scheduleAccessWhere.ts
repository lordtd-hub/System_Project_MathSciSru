import type { AssessmentRoundType, AssessmentSubmissionKind, Prisma } from "@prisma/client";
import { LATE_ROUND_EXCEPTION_TYPE, LATE_ROUND_EXCUSED_EXCEPTION_TYPE } from "@/lib/assessments/roundExceptions";

// Dashboard counts must include the same explicitly authorized closed-round work
// as the schedule queue. A grant for a different round never opens this one.
export function scheduleRoundAccessWhere(): Prisma.ExamScheduleProposalWhereInput {
  const rounds: Array<[AssessmentSubmissionKind, AssessmentRoundType]> = [
    ["PROGRESS_1", "PROGRESS_1"], ["PROGRESS_2", "PROGRESS_2"], ["FINAL_PRESENT", "FINAL_PRESENTATION"]
  ];
  return { OR: [
    { assessmentRound: { status: { in: ["SUBMISSION_OPEN", "SCORING_OPEN"] } } },
    ...rounds.map<Prisma.ExamScheduleProposalWhereInput>(([assessmentKind, roundType]) => ({ assessmentKind, OR: [
      { project: { roundExceptions: { some: { status: "OPEN", exceptionType: { in: [LATE_ROUND_EXCEPTION_TYPE, LATE_ROUND_EXCUSED_EXCEPTION_TYPE] }, assessmentRound: { roundType } } } } },
      { project: { academicResult: { status: "INCOMPLETE", continuations: { some: { status: "OPEN", assessmentRound: { roundType } } } } } }
    ] }))
  ] };
}
