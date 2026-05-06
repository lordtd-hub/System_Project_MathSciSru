import { AssessmentRoundType, PrismaClient } from "@prisma/client";
import { seedBaselineTeacherProfiles } from "../src/lib/admin/teacherBaseline";
import { progress1Criteria, progress2Criteria } from "../src/lib/scoring/progress1Scoring";
import { finalCriteria } from "../src/lib/scoring/finalScoring";
import { advisorCriteria } from "../src/lib/scoring/advisorScoring";

const prisma = new PrismaClient();

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

async function seedTeachers() {
  return seedBaselineTeacherProfiles(prisma, process.env.INITIAL_ADMIN_EMAIL);
}

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

async function seedRubric(roundType: AssessmentRoundType, name: string, items: BaselineRubricItem[]) {
  const rubric = await prisma.rubric.upsert({
    where: { roundType_version: { roundType, version: 1 } },
    create: { roundType, version: 1, name, active: true },
    update: { name, active: true }
  });

  const existingItemCount = await prisma.rubricItem.count({ where: { rubricId: rubric.id } });
  const matchingItemCount = await prisma.rubricItem.count({
    where: { rubricId: rubric.id, itemKey: { in: items.map((item) => item.itemKey) } }
  });

  if (existingItemCount > 0 && matchingItemCount === 0) {
    return { roundType, itemCount: existingItemCount, action: "kept-existing-items" };
  }

  for (const item of items) {
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

  return { roundType, itemCount: items.length, action: "upserted-items" };
}

async function seedRubrics() {
  const seeded = await Promise.all([
    seedRubric(AssessmentRoundType.PROPOSAL, "Proposal Presentation Rubric", proposalBaselineItems),
    seedRubric(
      AssessmentRoundType.PROGRESS_1,
      "Progress 1 Presentation Rubric",
      scoringCriteriaToRubricItems(progress1Criteria, "progress1")
    ),
    seedRubric(
      AssessmentRoundType.PROGRESS_2,
      "Progress 2 Presentation Rubric",
      scoringCriteriaToRubricItems(progress2Criteria, "progress2")
    ),
    seedRubric(
      AssessmentRoundType.FINAL_PRESENTATION,
      "Final Presentation Rubric",
      scoringCriteriaToRubricItems(finalCriteria, "final")
    )
  ]);

  return { seeded, advisorCriteriaCount: advisorCriteria.length };
}

async function inspectKnownE2eRows() {
  const [teachers, users, students, courseOfferings, projects] = await Promise.all([
    prisma.teacher.count({
      where: {
        OR: [{ email: { startsWith: "e2e.teacher." } }, { lastNameTh: "วงจรชีวิต" }]
      }
    }),
    prisma.user.count({
      where: {
        OR: [{ email: { startsWith: "e2e." } }, { googleSub: { startsWith: "e2e-" } }]
      }
    }),
    prisma.student.count({ where: { studentCode: { in: ["65123456789", "65123456790", "65123456791"] } } }),
    prisma.courseOffering.count({
      where: {
        OR: [{ id: "e2e-lifecycle-course-offering" }, { id: { startsWith: "e2e-offering-" } }, { id: { endsWith: "-demo" } }]
      }
    }),
    prisma.project.count({
      where: {
        OR: [
          { courseOfferingId: "e2e-lifecycle-course-offering" },
          { student: { studentCode: { in: ["65123456789", "65123456790", "65123456791"] } } }
        ]
      }
    })
  ]);

  return { teachers, users, students, courseOfferings, projects };
}

async function main() {
  console.log("Starting production baseline seed: teachers and rubrics only.");
  console.log("No students, projects, demo data, E2E data, or database reset will be created.");

  const teacherResult = await seedTeachers();
  const rubricResult = await seedRubrics();
  const teacherCount = await prisma.teacher.count();
  const rubricCount = await prisma.rubric.count();

  console.log(`Verified teacher source rows: ${teacherResult.sourceRows}`);
  console.log(`Current teacher profiles in database: ${teacherCount}`);
  console.log(`Initial admin teacher email linked from env: ${teacherResult.initialAdminLinked ? "yes" : "no"}`);
  console.log(`Current rubric records in database: ${rubricCount}`);
  for (const result of rubricResult.seeded) {
    console.log(`${result.roundType}: ${result.action} (${result.itemCount} items)`);
  }
  console.log(
    `Advisor score uses the code-level advisor rubric (${rubricResult.advisorCriteriaCount} criteria); no course-level AssessmentRound rubric is created for it.`
  );

  const e2eRows = await inspectKnownE2eRows();
  const e2eTotal = Object.values(e2eRows).reduce((sum, value) => sum + value, 0);
  if (e2eTotal > 0) {
    console.warn(
      `Known E2E/demo rows detected but not modified: ${JSON.stringify(e2eRows)}. Use a separate approved cleanup before real rollout.`
    );
  }
}

main()
  .catch((error) => {
    console.error("Production baseline seed failed.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
