import type { AssessmentRoundType, PrismaClient } from "@prisma/client";

export function readActiveAssessmentRubric(prisma: PrismaClient, roundType: AssessmentRoundType) {
  return prisma.rubric.findFirst({
    where: { roundType, active: true },
    include: { items: { orderBy: { displayOrder: "asc" } } }
  });
}

export function readProposalConditionRubric(prisma: PrismaClient) {
  return readActiveAssessmentRubric(prisma, "PROPOSAL");
}
