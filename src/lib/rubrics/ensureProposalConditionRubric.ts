import type { PrismaClient } from "@prisma/client";
import { findProposalQaCriterion, proposalQaRubricItems } from "./proposalQaRubric";

export async function ensureProposalConditionRubric(prisma: PrismaClient) {
  const existing = await prisma.rubric.findFirst({
    where: { roundType: "PROPOSAL", active: true },
    include: { items: { orderBy: { displayOrder: "asc" } } }
  });
  const items = proposalQaRubricItems();
  if (existing?.items.some((item) => Boolean(findProposalQaCriterion(item.itemKey)))) {
    await Promise.all(items.map((item) =>
      prisma.rubricItem.updateMany({
        where: { rubricId: existing.id, itemKey: item.itemKey },
        data: {
          groupLabelTh: item.groupLabelTh,
          itemLabelTh: item.itemLabelTh,
          evidenceHint: item.evidenceHint
        }
      })
    ));
    return prisma.rubric.findUniqueOrThrow({
      where: { id: existing.id },
      include: { items: { orderBy: { displayOrder: "asc" } } }
    });
  }

  const latest = await prisma.rubric.findFirst({
    where: { roundType: "PROPOSAL" },
    orderBy: { version: "desc" },
    select: { version: true }
  });
  await prisma.rubric.updateMany({ where: { roundType: "PROPOSAL", active: true }, data: { active: false } });
  return prisma.rubric.create({
    data: {
      roundType: "PROPOSAL",
      name: "เกณฑ์ประเมินการเสนอหัวข้อแบบตรวจเงื่อนไข",
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
