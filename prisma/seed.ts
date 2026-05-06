import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { courseLevelRoundTypes, defaultCourseRoundName, defaultCourseRoundWeight } from "../src/lib/assessments/courseRounds";
import { termDisplayName } from "../src/lib/terms/display";

const prisma = new PrismaClient();

const proposalRubric = [
  {
    key: "clarity",
    label: "ความชัดเจนของข้อเสนอ",
    items: [
      ["title_reflects_content", "ชื่อหัวข้อสะท้อนเนื้อหาหลักของโครงงาน", 3, false],
      ["main_problem_clear", "ระบุปัญหาหรือคำถามหลักของโครงงานชัดเจน", 4, true],
      ["objectives_clear", "ระบุวัตถุประสงค์ของโครงงานชัดเจน", 4, true],
      ["scope_clear", "ขอบเขตของงานระบุได้ว่า ศึกษาเรื่องใดและไม่กว้างเกินไป", 4, false],
      ["key_terms_explained", "อธิบายคำสำคัญ นิยาม หรือ notation ที่จำเป็นต่อหัวข้อ", 3, false],
      ["expected_result_clear", "ระบุผลลัพธ์ที่คาดว่าจะได้จากโครงงาน", 2, false]
    ]
  },
  {
    key: "relevance",
    label: "ความเกี่ยวข้องและความเหมาะสม",
    items: [
      ["math_relevance", "หัวข้อมีความเกี่ยวข้องกับคณิตศาสตร์หรือสาขาที่เรียน", 5, true],
      ["motivation", "อธิบาย motivation หรือเหตุผลที่เลือกหัวข้อนี้", 4, false],
      ["references", "ระบุแหล่งอ้างอิงเบื้องต้นอย่างน้อย 2 แหล่ง", 4, false],
      ["value", "อธิบายประโยชน์ต่อการเรียนรู้ การประยุกต์ หรือองค์ความรู้", 4, false],
      ["feasible", "หัวข้อเหมาะสมกับเวลาหนึ่งภาคการศึกษาและระดับของนักศึกษา", 3, true]
    ]
  },
  {
    key: "plan",
    label: "คุณภาพของแผนการศึกษา",
    items: [
      ["method", "ระบุวิธีการ ทฤษฎี เครื่องมือ หรือแนวทางคณิตศาสตร์ที่จะใช้", 6, true],
      ["steps", "แผนการทำงานแบ่งเป็นขั้นตอนชัดเจน", 5, false],
      ["timeline", "มี timeline รายสัปดาห์หรือรายเดือน", 5, true],
      ["resources", "ระบุเอกสาร ตัวอย่าง โปรแกรม ข้อมูล หรือทรัพยากรที่ต้องใช้", 4, false],
      ["risks", "ระบุความเสี่ยงหรืออุปสรรคที่อาจเกิดขึ้น", 4, false],
      ["verification", "ระบุวิธีตรวจสอบความถูกต้องของผลลัพธ์ เช่น proof, calculation, comparison, example, computation หรือวิธีอื่นที่เหมาะสม", 4, false],
      ["consultation", "มีการปรึกษาหรือระบุอาจารย์ที่ปรึกษาเบื้องต้น", 2, false]
    ]
  },
  {
    key: "communication",
    label: "การนำเสนอและการสื่อสาร",
    items: [
      ["materials_structure", "สไลด์หรือเอกสารประกอบมีโครงสร้างครบ เช่น title, objective, method, timeline", 4, false],
      ["presentation_flow", "การนำเสนอเรียงลำดับจาก motivation ไป objective ไป method ไป expected outcome", 4, false],
      ["time", "ใช้เวลาอยู่ในช่วงที่กำหนด", 3, false],
      ["own_words", "อธิบายโดยใช้ภาษาของตนเอง ไม่อ่านสไลด์ทั้งหมด", 3, false],
      ["notation_readable", "notation, formula, figure หรือ table อ่านได้ชัดเจน", 3, false],
      ["qa", "ตอบคำถามเกี่ยวกับแผนงานหรือขอบเขตโครงงานได้", 3, false]
    ]
  },
  {
    key: "readiness",
    label: "ความพร้อมโดยรวม",
    items: [
      ["scope_understanding", "นักศึกษาแสดงให้เห็นว่าเข้าใจ scope ของงาน", 3, false],
      ["first_steps", "นักศึกษาบอกขั้นตอนแรกที่จะทำหลังผ่านหัวข้อได้", 3, false],
      ["uncertainty", "นักศึกษาระบุสิ่งที่ยังไม่แน่ใจหรือต้องปรึกษาเพิ่มเติมได้", 2, false],
      ["ready", "นักศึกษาแสดงความพร้อมที่จะเริ่มทำงานจริง", 2, false]
    ]
  }
] as const;

function parseCsvLine(line: string): string[] {
  return line.split(",").map((value) => value.trim());
}

async function seedTeachers() {
  const csv = readFileSync(join(process.cwd(), "SEED_TEACHERS.csv"), "utf8").trim();
  const [, ...lines] = csv.split(/\r?\n/);

  for (const line of lines) {
    const [
      academicPrefix,
      firstNameTh,
      lastNameTh,
      email,
      department,
      ,
      active,
      canEvaluateProposal
    ] = parseCsvLine(line);

    await prisma.teacher.upsert({
      where: {
        academicPrefix_firstNameTh_lastNameTh: {
          academicPrefix,
          firstNameTh,
          lastNameTh
        }
      },
      update: {
        email: email || null,
        department,
        active: active.toUpperCase() === "TRUE",
        canEvaluateProposal: canEvaluateProposal.toUpperCase() === "TRUE",
        isInternal: true
      },
      create: {
        academicPrefix,
        firstNameTh,
        lastNameTh,
        email: email || null,
        department,
        active: active.toUpperCase() === "TRUE",
        canEvaluateProposal: canEvaluateProposal.toUpperCase() === "TRUE",
        isInternal: true
      }
    });
  }
}

async function seedRubric() {
  const rubric = await prisma.rubric.upsert({
    where: { roundType_version: { roundType: "PROPOSAL", version: 1 } },
    update: { active: true, name: "Proposal Presentation Checklist" },
    create: {
      roundType: "PROPOSAL",
      version: 1,
      active: true,
      name: "Proposal Presentation Checklist"
    }
  });

  let displayOrder = 1;
  for (const group of proposalRubric) {
    for (const [key, label, points, isCritical] of group.items) {
      await prisma.rubricItem.upsert({
        where: { rubricId_itemKey: { rubricId: rubric.id, itemKey: key } },
        update: {
          groupKey: group.key,
          groupLabelTh: group.label,
          itemLabelTh: label,
          points,
          displayOrder,
          isCritical
        },
        create: {
          rubricId: rubric.id,
          groupKey: group.key,
          groupLabelTh: group.label,
          itemKey: key,
          itemLabelTh: label,
          points,
          displayOrder,
          isCritical
        }
      });
      displayOrder += 1;
    }
  }
}

async function seedInitialAdmin() {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return;

  await prisma.user.upsert({
    where: { email },
    update: {
      globalRole: "ADMIN",
      emailDomain: email.split("@")[1] ?? null,
      active: true
    },
    create: {
      email,
      emailDomain: email.split("@")[1] ?? null,
      globalRole: "ADMIN",
      active: true,
      name: "Initial Admin"
    }
  });
}

async function seedDefaultCourse() {
  const academicYear = await prisma.academicYear.upsert({
    where: { yearBe: 2568 },
    update: { active: true },
    create: { yearBe: 2568, active: true }
  });

  const term = await prisma.term.upsert({
    where: {
      academicYearId_termType: {
        academicYearId: academicYear.id,
        termType: "SEMESTER_1"
      }
    },
    update: { displayName: termDisplayName("SEMESTER_1", 2568), status: "ACTIVE" },
    create: {
      academicYearId: academicYear.id,
      termType: "SEMESTER_1",
      displayName: termDisplayName("SEMESTER_1", 2568),
      status: "ACTIVE"
    }
  });

  const offering = await prisma.courseOffering.upsert({
    where: { id: `${term.id}-default` },
    update: { status: "ACTIVE" },
    create: {
      id: `${term.id}-default`,
      termId: term.id,
      status: "ACTIVE"
    }
  });

  for (const roundType of courseLevelRoundTypes) {
    await prisma.assessmentRound.upsert({
      where: {
        courseOfferingId_roundType: {
          courseOfferingId: offering.id,
          roundType
        }
      },
      update: { name: defaultCourseRoundName(roundType), courseWeight: defaultCourseRoundWeight(roundType), rawScoreMax: 100 },
      create: {
        courseOfferingId: offering.id,
        roundType,
        name: defaultCourseRoundName(roundType),
        courseWeight: defaultCourseRoundWeight(roundType),
        rawScoreMax: 100,
        showEvaluatorNameToStudent: false
      }
    });
  }
}

async function main() {
  await seedTeachers();
  await seedRubric();
  await seedInitialAdmin();
  await seedDefaultCourse();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
