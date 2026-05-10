import { AssessmentRoundType, PrismaClient } from "@prisma/client";
import { seedBaselineTeacherProfiles } from "../src/lib/admin/teacherBaseline";
import { advisorCriteria } from "../src/lib/scoring/advisorScoring";
import { proposalQaRubricItems } from "../src/lib/rubrics/proposalQaRubric";
import { progressQaRubricItems } from "../src/lib/rubrics/progressQaRubric";
import { finalQaRubricItems } from "../src/lib/rubrics/finalQaRubric";

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

async function upsertRubricItems(rubricId: string, items: BaselineRubricItem[]) {
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
    if (
      roundType === AssessmentRoundType.PROPOSAL ||
      roundType === AssessmentRoundType.PROGRESS_1 ||
      roundType === AssessmentRoundType.PROGRESS_2 ||
      roundType === AssessmentRoundType.FINAL_PRESENTATION
    ) {
      const latest = await prisma.rubric.findFirst({
        where: { roundType },
        orderBy: { version: "desc" },
        select: { version: true }
      });
      await prisma.rubric.updateMany({ where: { roundType, active: true }, data: { active: false } });
      const replacement = await prisma.rubric.create({
        data: {
          roundType,
          version: (latest?.version ?? 1) + 1,
          name,
          active: true
        }
      });
      await upsertRubricItems(replacement.id, items);
      return { roundType, itemCount: items.length, action: "created-new-version" };
    }

    return { roundType, itemCount: existingItemCount, action: "kept-existing-items" };
  }

  await upsertRubricItems(rubric.id, items);

  return { roundType, itemCount: items.length, action: "upserted-items" };
}

async function seedRubrics() {
  const seeded = await Promise.all([
    seedRubric(AssessmentRoundType.PROPOSAL, "Proposal Presentation Condition Rubric", proposalQaRubricItems()),
    seedRubric(
      AssessmentRoundType.PROGRESS_1,
      "Progress 1 Plan-Based Condition Rubric",
      progressQaRubricItems()
    ),
    seedRubric(
      AssessmentRoundType.PROGRESS_2,
      "Progress 2 Plan-Based Condition Rubric",
      progressQaRubricItems()
    ),
    seedRubric(
      AssessmentRoundType.FINAL_PRESENTATION,
      "Final Evidence-Driven Condition Rubric",
      finalQaRubricItems()
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
