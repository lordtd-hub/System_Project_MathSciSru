import { AssessmentRoundType, type PrismaClient } from "@prisma/client";
import { finalCriteria } from "@/lib/scoring/finalScoring";
import { progress1Criteria, progress2Criteria } from "@/lib/scoring/progress1Scoring";

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

const proposalBaselineItems: BaselineRubricItem[] = [
  {
    groupKey: "clarity",
    groupLabelTh: "Clarity of Proposal",
    itemKey: "clarity_overall",
    itemLabelTh: "Problem statement, objectives, and scope are clear",
    points: 20,
    displayOrder: 1,
    isCritical: true
  },
  {
    groupKey: "relevance",
    groupLabelTh: "Relevance of Project",
    itemKey: "relevance_overall",
    itemLabelTh: "Project is relevant to mathematical project course expectations",
    points: 20,
    displayOrder: 2,
    isCritical: true
  },
  {
    groupKey: "research_plan",
    groupLabelTh: "Quality of Research Plan",
    itemKey: "research_plan_overall",
    itemLabelTh: "Methods, references, timeline, and feasibility are appropriate",
    points: 30,
    displayOrder: 3,
    isCritical: true
  },
  {
    groupKey: "presentation",
    groupLabelTh: "Presentation and Communication",
    itemKey: "presentation_overall",
    itemLabelTh: "Presentation communicates the proposal clearly",
    points: 20,
    displayOrder: 4
  },
  {
    groupKey: "overall",
    groupLabelTh: "Overall / Readiness",
    itemKey: "overall_readiness",
    itemLabelTh: "Student is ready to proceed with the project",
    points: 10,
    displayOrder: 5
  }
];

function scoringCriteriaToRubricItems(
  criteria: readonly { key: string; label: string; max: number; order: number }[],
  groupPrefix: string
): BaselineRubricItem[] {
  return criteria.map((criterion) => ({
    groupKey: `${groupPrefix}_${criterion.key}`,
    groupLabelTh: criterion.label,
    itemKey: criterion.key,
    itemLabelTh: criterion.label,
    points: criterion.max,
    displayOrder: criterion.order,
    isCritical: criterion.order <= 3
  }));
}

export const baselineRubricDefinitions: BaselineRubricDefinition[] = [
  {
    roundType: AssessmentRoundType.PROPOSAL,
    name: "Proposal Presentation Rubric",
    items: proposalBaselineItems
  },
  {
    roundType: AssessmentRoundType.PROGRESS_1,
    name: "Progress 1 Presentation Rubric",
    items: scoringCriteriaToRubricItems(progress1Criteria, "progress1")
  },
  {
    roundType: AssessmentRoundType.PROGRESS_2,
    name: "Progress 2 Presentation Rubric",
    items: scoringCriteriaToRubricItems(progress2Criteria, "progress2")
  },
  {
    roundType: AssessmentRoundType.FINAL_PRESENTATION,
    name: "Final Presentation Rubric",
    items: scoringCriteriaToRubricItems(finalCriteria, "final")
  }
];

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
    return { roundType: definition.roundType, itemCount: existingItemCount, action: "kept-existing-items" as const };
  }

  for (const item of definition.items) {
    await prisma.rubricItem.upsert({
      where: { rubricId_itemKey: { rubricId: rubric.id, itemKey: item.itemKey } },
      create: {
        rubricId: rubric.id,
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

  return { roundType: definition.roundType, itemCount: definition.items.length, action: "upserted-items" as const };
}

export async function seedBaselineRubrics(prisma: PrismaClient) {
  const seeded = await Promise.all(baselineRubricDefinitions.map((definition) => seedRubric(prisma, definition)));
  return { seeded };
}
