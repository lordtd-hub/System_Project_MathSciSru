import type { PrismaClient } from "@prisma/client";
import { findProposalQaCriterion, proposalQaRubricItems } from "./proposalQaRubric";

export async function ensureProposalConditionRubric(prisma: PrismaClient) {
  const existing = await prisma.rubric.findFirst({
    where: { roundType: "PROPOSAL", active: true },
    include: { items: { orderBy: { displayOrder: "asc" } } }
  });
  if (existing?.items.some((item) => Boolean(findProposalQaCriterion(item.itemKey)))) return existing;

  const items = proposalQaRubricItems();
  const latest = await prisma.rubric.findFirst({
    where: { roundType: "PROPOSAL" },
    orderBy: { version: "desc" },
    select: { version: true }
  });
  await prisma.rubric.updateMany({ where: { roundType: "PROPOSAL", active: true }, data: { active: false } });
  return prisma.rubric.create({
    data: {
      roundType: "PROPOSAL",
      name: "Proposal Presentation Condition Rubric",
      version: (latest?.version ?? 0) + 1,
      active: true,
      items: {
        create: items.map((item) => ({
          groupKey: item.groupKey,
          groupLabelTh: item.groupLabelTh,
          itemKey: item.itemKey,
          itemLabelTh: item.itemLabelTh,
          points: item.points,
          displayOrder: item.displayOrder,
          isCritical: item.isCritical,
          evidenceHint: item.evidenceHint
        }))
      }
    },
    include: { items: { orderBy: { displayOrder: "asc" } } }
  });
}
