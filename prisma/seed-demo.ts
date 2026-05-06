import { PrismaClient, type Project, type Teacher } from "@prisma/client";
import { courseLevelRoundTypes, defaultCourseRoundName, defaultCourseRoundWeight } from "../src/lib/assessments/courseRounds";
import { termDisplayName } from "../src/lib/terms/display";

const prisma = new PrismaClient();

const demoTeachers = [
  ["ผศ.ดร.", "สิทธิโชค", "ทรงสอาด"],
  ["ผศ.", "กันญารัตน์", "หนูชุม"],
  ["อ.", "กันยากร", "อ่อนรักษ์"],
  ["ผศ.ดร.", "เกตุกนก", "หนูดี"],
  ["ผศ.", "จิราพร", "เสนจันทร์"],
  ["อ.ดร.", "ธนนต์", "ก่อเกียรติสกุล"],
  ["อ.", "ศุภชัย", "ดำคำ"],
  ["ผศ.", "สุจารี", "ดำศรี"],
  ["อ.ดร.", "อรรถกร", "ศักดา"],
  ["ผศ.", "อรวรรณ", "สืบเสน"],
  ["ผศ.", "อัญชุลี", "ณ ตะกั่วทุ่ง"]
] as const;

const demoStudents = [
  { studentCode: "65123456789", firstNameTh: "สมชาย", lastNameTh: "ใจดี", status: "DRAFT" as const },
  { studentCode: "65123456790", firstNameTh: "สมหญิง", lastNameTh: "รักเรียน", status: "PENDING_ADVISOR" as const },
  { studentCode: "65123456791", firstNameTh: "สมปอง", lastNameTh: "ตั้งใจ", status: "PROPOSAL_REVIEW" as const }
];

function studentEmail(studentCode: string) {
  return `${studentCode}@student.sru.ac.th`;
}

function teacherEmail(index: number) {
  return `demo.teacher${String(index + 1).padStart(2, "0")}@sru.ac.th`;
}

async function ensureTimeline(project: Project, eventType: string, eventTitle: string, eventDescription?: string) {
  const existing = await prisma.projectTimelineEvent.findFirst({ where: { projectId: project.id, eventType, eventTitle } });
  if (existing) {
    return prisma.projectTimelineEvent.update({ where: { id: existing.id }, data: { eventDescription } });
  }
  return prisma.projectTimelineEvent.create({ data: { projectId: project.id, eventType, eventTitle, eventDescription } });
}

async function ensureAdvisorRequest(project: Project, teacher: Teacher, status: "PENDING" | "APPROVED") {
  const existing = await prisma.advisorRequest.findFirst({
    where: { projectId: project.id, advisorTeacherId: teacher.id }
  });
  const requestedAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * (status === "PENDING" ? 9 : 3));
  const data = {
    studentId: project.studentId,
    advisorTeacherId: teacher.id,
    status,
    studentMessage: "ขออนุมัติเป็นอาจารย์ที่ปรึกษาสำหรับหัวข้อโครงงานตัวอย่าง",
    advisorComment: status === "APPROVED" ? "เห็นชอบให้ดำเนินการต่อ" : null,
    requestedAt,
    reviewedAt: status === "APPROVED" ? new Date(Date.now() - 1000 * 60 * 60 * 24 * 2) : null,
    reminderDueAt: new Date(requestedAt.getTime() + 1000 * 60 * 60 * 24 * 7)
  };
  if (existing) return prisma.advisorRequest.update({ where: { id: existing.id }, data });
  return prisma.advisorRequest.create({ data: { ...data, projectId: project.id } });
}

async function main() {
  const academicYear = await prisma.academicYear.upsert({
    where: { yearBe: 2568 },
    update: { active: true },
    create: { yearBe: 2568, active: true }
  });
  const term = await prisma.term.upsert({
    where: { academicYearId_termType: { academicYearId: academicYear.id, termType: "SEMESTER_1" } },
    update: { displayName: termDisplayName("SEMESTER_1", 2568), status: "ACTIVE" },
    create: {
      academicYearId: academicYear.id,
      termType: "SEMESTER_1",
      displayName: termDisplayName("SEMESTER_1", 2568),
      status: "ACTIVE"
    }
  });
  const offering = await prisma.courseOffering.upsert({
    where: { id: `${term.id}-demo` },
    update: { status: "ACTIVE", courseTitle: "Mathematical Project Course" },
    create: { id: `${term.id}-demo`, termId: term.id, status: "ACTIVE", courseTitle: "Mathematical Project Course" }
  });
  const rounds = await Promise.all(courseLevelRoundTypes.map((roundType) =>
    prisma.assessmentRound.upsert({
      where: {
        courseOfferingId_roundType: {
          courseOfferingId: offering.id,
          roundType
        }
      },
      update: {
        name: roundType === "PROPOSAL" ? "Demo Proposal Presentation" : defaultCourseRoundName(roundType),
        status: roundType === "PROPOSAL" ? "SCORING_OPEN" : "DRAFT",
        courseWeight: defaultCourseRoundWeight(roundType),
        rawScoreMax: 100
      },
      create: {
        courseOfferingId: offering.id,
        roundType,
        name: roundType === "PROPOSAL" ? "Demo Proposal Presentation" : defaultCourseRoundName(roundType),
        status: roundType === "PROPOSAL" ? "SCORING_OPEN" : "DRAFT",
        courseWeight: defaultCourseRoundWeight(roundType),
        rawScoreMax: 100,
        showEvaluatorNameToStudent: true
      }
    })
  ));
  const round = rounds.find((item) => item.roundType === "PROPOSAL")!;

  const teachers: Teacher[] = [];
  for (const [index, [academicPrefix, firstNameTh, lastNameTh]] of demoTeachers.entries()) {
    const email = teacherEmail(index);
    const user = await prisma.user.upsert({
      where: { email },
      update: { globalRole: "TEACHER", name: `${academicPrefix}${firstNameTh} ${lastNameTh}`, active: true },
      create: {
        email,
        emailDomain: "sru.ac.th",
        googleSub: `demo-teacher-${index + 1}`,
        name: `${academicPrefix}${firstNameTh} ${lastNameTh}`,
        globalRole: "TEACHER",
        active: true
      }
    });
    const teacher = await prisma.teacher.upsert({
      where: { academicPrefix_firstNameTh_lastNameTh: { academicPrefix, firstNameTh, lastNameTh } },
      update: { email, userId: user.id, department: "Mathematics", isInternal: true, active: true, canEvaluateProposal: true },
      create: {
        academicPrefix,
        firstNameTh,
        lastNameTh,
        email,
        userId: user.id,
        department: "Mathematics",
        isInternal: true,
        active: true,
        canEvaluateProposal: true
      }
    });
    teachers.push(teacher);
  }

  for (const demo of demoStudents) {
    const email = studentEmail(demo.studentCode);
    const user = await prisma.user.upsert({
      where: { email },
      update: { globalRole: "STUDENT", name: `${demo.firstNameTh} ${demo.lastNameTh}`, active: true },
      create: {
        email,
        emailDomain: "student.sru.ac.th",
        googleSub: `demo-student-${demo.studentCode}`,
        name: `${demo.firstNameTh} ${demo.lastNameTh}`,
        globalRole: "STUDENT",
        active: true
      }
    });
    const student = await prisma.student.upsert({
      where: { studentCode: demo.studentCode },
      update: { firstNameTh: demo.firstNameTh, lastNameTh: demo.lastNameTh, generatedEmail: email, userId: user.id, active: true },
      create: { studentCode: demo.studentCode, firstNameTh: demo.firstNameTh, lastNameTh: demo.lastNameTh, generatedEmail: email, userId: user.id }
    });
    await prisma.studentProfile.upsert({
      where: { studentId: student.id },
      update: { phone: "0800000000", lineId: `demo_${demo.studentCode}`, preferredName: demo.firstNameTh, completedAt: new Date() },
      create: { studentId: student.id, phone: "0800000000", lineId: `demo_${demo.studentCode}`, preferredName: demo.firstNameTh, completedAt: new Date() }
    });
    const project = await prisma.project.upsert({
      where: { courseOfferingId_studentId: { courseOfferingId: offering.id, studentId: student.id } },
      update: {
        status: demo.status,
        currentTitleTh: `หัวข้อโครงงานตัวอย่างของ${demo.firstNameTh}`,
        currentTitleEn: `Demo project for ${demo.studentCode}`
      },
      create: {
        courseOfferingId: offering.id,
        studentId: student.id,
        status: demo.status,
        currentTitleTh: `หัวข้อโครงงานตัวอย่างของ${demo.firstNameTh}`,
        currentTitleEn: `Demo project for ${demo.studentCode}`
      }
    });

    await ensureTimeline(project, "DEMO_PROJECT_CREATED", "สร้างข้อมูลโครงงานตัวอย่าง", `สถานะตัวอย่าง: ${demo.status}`);

    if (demo.status === "PENDING_ADVISOR" || demo.status === "PROPOSAL_REVIEW") {
      const advisor = teachers[0];
      await ensureAdvisorRequest(project, advisor, demo.status === "PENDING_ADVISOR" ? "PENDING" : "APPROVED");
      await prisma.projectOrigin.upsert({
        where: { projectId: project.id },
        update: {
          initialProjectTitleTh: project.currentTitleTh ?? "หัวข้อโครงงานตัวอย่าง",
          initialProjectTitleEn: project.currentTitleEn,
          sourceType: "STUDENT_INITIATED",
          reasonForTopic: "ต้องการศึกษาแนวคิดทางคณิตศาสตร์จากปัญหาที่สนใจ",
          expectedMathArea: "คณิตศาสตร์ประยุกต์และการวิเคราะห์ข้อมูล",
          tentativeAdvisorId: advisor.id,
          consultationSummary: "ได้พูดคุยแนวทางเบื้องต้นกับอาจารย์ที่ปรึกษา",
          initialReferences: "เอกสารอ้างอิงตัวอย่าง 1\nเอกสารอ้างอิงตัวอย่าง 2",
          materialLink: "https://drive.google.com/demo",
          declarationAccepted: true,
          status: "SUBMITTED",
          submittedAt: new Date()
        },
        create: {
          projectId: project.id,
          initialProjectTitleTh: project.currentTitleTh ?? "หัวข้อโครงงานตัวอย่าง",
          initialProjectTitleEn: project.currentTitleEn,
          sourceType: "STUDENT_INITIATED",
          reasonForTopic: "ต้องการศึกษาแนวคิดทางคณิตศาสตร์จากปัญหาที่สนใจ",
          expectedMathArea: "คณิตศาสตร์ประยุกต์และการวิเคราะห์ข้อมูล",
          tentativeAdvisorId: advisor.id,
          consultationSummary: "ได้พูดคุยแนวทางเบื้องต้นกับอาจารย์ที่ปรึกษา",
          initialReferences: "เอกสารอ้างอิงตัวอย่าง 1\nเอกสารอ้างอิงตัวอย่าง 2",
          materialLink: "https://drive.google.com/demo",
          declarationAccepted: true,
          status: "SUBMITTED",
          submittedAt: new Date()
        }
      });
      await ensureTimeline(project, "PROJECT_ORIGIN_SUBMITTED", "ส่งข้อมูลเสนอหัวข้อ", "นักศึกษาส่งข้อมูลหัวข้อและเลือกอาจารย์ที่ปรึกษา");
    }

    if (demo.status === "PROPOSAL_REVIEW") {
      const attempt = await prisma.assessmentAttempt.upsert({
        where: { projectId_assessmentRoundId_attemptNo: { projectId: project.id, assessmentRoundId: round.id, attemptNo: 1 } },
        update: { status: "SCORING_OPEN", attemptType: "MAIN_PROPOSAL" },
        create: {
          projectId: project.id,
          assessmentRoundId: round.id,
          attemptNo: 1,
          attemptType: "MAIN_PROPOSAL",
          status: "SCORING_OPEN"
        }
      });
      await prisma.presentationSubmission.upsert({
        where: { assessmentAttemptId: attempt.id },
        update: {
          projectId: project.id,
          studentId: student.id,
          titleTh: project.currentTitleTh ?? "หัวข้อโครงงานตัวอย่าง",
          titleEn: project.currentTitleEn,
          abstractText: "บทคัดย่อสำหรับ Proposal ตัวอย่าง พร้อมสมการ $x^2 + y^2 = r^2$",
          contentJson: {
            motivationBackground: "ที่มาและความสำคัญของปัญหา",
            objectives: "ศึกษาวิธีการและสร้างตัวอย่างการประยุกต์",
            proposedMethods: "ทบทวนทฤษฎี ทดลองคำนวณ และตรวจสอบผล",
            expectedOutcomes: "ได้รายงานและสไลด์ Proposal ที่ชัดเจน",
            timeline: "สัปดาห์ 1-4 ทบทวนเอกสาร สัปดาห์ 5-8 ทดลอง",
            questionsForTeachers: "ขอคำแนะนำเรื่องขอบเขตงาน"
          },
          materialLink: "https://drive.google.com/demo-proposal",
          declarationAccepted: true,
          status: "SUBMITTED",
          submittedAt: new Date()
        },
        create: {
          assessmentAttemptId: attempt.id,
          projectId: project.id,
          studentId: student.id,
          titleTh: project.currentTitleTh ?? "หัวข้อโครงงานตัวอย่าง",
          titleEn: project.currentTitleEn,
          abstractText: "บทคัดย่อสำหรับ Proposal ตัวอย่าง พร้อมสมการ $x^2 + y^2 = r^2$",
          contentJson: {
            motivationBackground: "ที่มาและความสำคัญของปัญหา",
            objectives: "ศึกษาวิธีการและสร้างตัวอย่างการประยุกต์",
            proposedMethods: "ทบทวนทฤษฎี ทดลองคำนวณ และตรวจสอบผล",
            expectedOutcomes: "ได้รายงานและสไลด์ Proposal ที่ชัดเจน",
            timeline: "สัปดาห์ 1-4 ทบทวนเอกสาร สัปดาห์ 5-8 ทดลอง",
            questionsForTeachers: "ขอคำแนะนำเรื่องขอบเขตงาน"
          },
          materialLink: "https://drive.google.com/demo-proposal",
          declarationAccepted: true,
          status: "SUBMITTED",
          submittedAt: new Date()
        }
      });
      for (const teacher of teachers.slice(0, 3)) {
        await prisma.evaluatorAssignment.upsert({
          where: { assessmentAttemptId_evaluatorUserId: { assessmentAttemptId: attempt.id, evaluatorUserId: teacher.userId! } },
          update: { teacherId: teacher.id, status: "ASSIGNED" },
          create: {
            assessmentAttemptId: attempt.id,
            evaluatorUserId: teacher.userId!,
            teacherId: teacher.id,
            evaluatorDisplayNameSnapshot: `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`,
            isRequired: true,
            status: "ASSIGNED"
          }
        });
      }
      await prisma.proposalVote.upsert({
        where: { projectId_teacherId_assessmentAttemptId: { projectId: project.id, teacherId: teachers[1].id, assessmentAttemptId: attempt.id } },
        update: { vote: "REVISE", comment: "ควรเพิ่มรายละเอียดแผนดำเนินงาน", visibleToStudent: true },
        create: { projectId: project.id, teacherId: teachers[1].id, assessmentAttemptId: attempt.id, vote: "REVISE", comment: "ควรเพิ่มรายละเอียดแผนดำเนินงาน", visibleToStudent: true }
      });
      await ensureTimeline(project, "PROPOSAL_SUBMITTED", "ส่ง Proposal", "นักศึกษาแนบ abstract และลิงก์ Google Drive แล้ว");
      await ensureTimeline(project, "SCORING_OPENED", "เปิดรอบประเมิน Proposal", "อาจารย์ภายในสามารถประเมินและให้ comment ได้");
    }
  }

  const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail) {
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { globalRole: "ADMIN", name: "Development Admin", active: true },
      create: {
        email: adminEmail,
        emailDomain: adminEmail.split("@")[1] ?? null,
        googleSub: "demo-admin",
        name: "Development Admin",
        globalRole: "ADMIN",
        active: true
      }
    });
  }
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
