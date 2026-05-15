import { AssessmentRoundType, type PrismaClient } from "@prisma/client";
import { finalQaRubricItems } from "@/lib/rubrics/finalQaRubric";
import { progressQaRubricItems } from "@/lib/rubrics/progressQaRubric";
import { proposalQaRubricItems } from "@/lib/rubrics/proposalQaRubric";

type BaselineRubricItem = {
  groupKey: string;
  groupLabelTh: string;
  itemKey: string;
  itemLabelTh: string;
  points: number;
  displayOrder: number;
  isCritical?: boolean;
  evidenceHint?: string | null;
};

type BaselineRubricDefinition = {
  roundType: AssessmentRoundType;
  name: string;
  items: BaselineRubricItem[];
};

export const baselineRubricDefinitions: BaselineRubricDefinition[] = [
  {
    roundType: AssessmentRoundType.PROPOSAL,
    name: "เกณฑ์ประเมินการเสนอหัวข้อแบบตรวจเงื่อนไข",
    items: proposalQaRubricItems()
  },
  {
    roundType: AssessmentRoundType.PROGRESS_1,
    name: "เกณฑ์ประเมินความก้าวหน้าครั้งที่ 1 ตามแผนงาน",
    items: progressQaRubricItems()
  },
  {
    roundType: AssessmentRoundType.PROGRESS_2,
    name: "เกณฑ์ประเมินความก้าวหน้าครั้งที่ 2 ตามแผนงาน",
    items: progressQaRubricItems()
  },
  {
    roundType: AssessmentRoundType.FINAL_PRESENTATION,
    name: "เกณฑ์ประเมินการสอบนำเสนอขั้นสุดท้ายตามหลักฐาน",
    items: finalQaRubricItems()
  }
];

async function upsertRubricItems(prisma: PrismaClient, rubricId: string, items: BaselineRubricItem[]) {
  for (const item of items) {
    await prisma.rubricItem.upsert({
      where: { rubricId_itemKey: { rubricId, itemKey: item.itemKey } },
      create: {
        rubricId,
        groupKey: item.groupKey,
        groupLabelTh: item.groupLabelTh,
        itemKey: item.itemKey,
        itemLabelTh: item.itemLabelTh,
        points: item.points,
        displayOrder: item.displayOrder,
        isCritical: item.isCritical ?? false,
        evidenceHint: item.evidenceHint ?? null
      },
      update: {
        groupKey: item.groupKey,
        groupLabelTh: item.groupLabelTh,
        itemLabelTh: item.itemLabelTh,
        points: item.points,
        displayOrder: item.displayOrder,
        isCritical: item.isCritical ?? false,
        evidenceHint: item.evidenceHint ?? null
      }
    });
  }
}

async function seedRubric(prisma: PrismaClient, definition: BaselineRubricDefinition) {
  const rubric = await prisma.rubric.upsert({
    where: { roundType_version: { roundType: definition.roundType, version: 1 } },
    create: { roundType: definition.roundType, version: 1, name: definition.name, active: true },
    update: { name: definition.name, active: true }
  });

  const existingItemCount = await prisma.rubricItem.count({ where: { rubricId: rubric.id } });
  const matchingItemCount = await prisma.rubricItem.count({
    where: { rubricId: rubric.id, itemKey: { in: definition.items.map((item) => item.itemKey) } }
  });

  if (existingItemCount > 0 && matchingItemCount === 0) {
    if (
      definition.roundType === AssessmentRoundType.PROPOSAL ||
      definition.roundType === AssessmentRoundType.PROGRESS_1 ||
      definition.roundType === AssessmentRoundType.PROGRESS_2 ||
      definition.roundType === AssessmentRoundType.FINAL_PRESENTATION
    ) {
      const latest = await prisma.rubric.findFirst({
        where: { roundType: definition.roundType },
        orderBy: { version: "desc" },
        select: { version: true }
      });
      await prisma.rubric.updateMany({ where: { roundType: definition.roundType, active: true }, data: { active: false } });
      const replacement = await prisma.rubric.create({
        data: {
          roundType: definition.roundType,
          version: (latest?.version ?? 1) + 1,
          name: definition.name,
          active: true
        }
      });
      await upsertRubricItems(prisma, replacement.id, definition.items);
      return { roundType: definition.roundType, itemCount: definition.items.length, action: "created-new-version" as const };
    }

    return { roundType: definition.roundType, itemCount: existingItemCount, action: "kept-existing-items" as const };
  }

  await upsertRubricItems(prisma, rubric.id, definition.items);

  return { roundType: definition.roundType, itemCount: definition.items.length, action: "upserted-items" as const };
}

export async function seedBaselineRubrics(prisma: PrismaClient) {
  const seeded = await Promise.all(baselineRubricDefinitions.map((definition) => seedRubric(prisma, definition)));
  return { seeded };
}
