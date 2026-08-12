import type { PrismaClient } from "@prisma/client";

export function readProposalConditionRubric(prisma: PrismaClient) {
  return prisma.rubric.findFirst({
    where: { roundType: "PROPOSAL", active: true },
    include: { items: { orderBy: { displayOrder: "asc" } } }
  });
}
