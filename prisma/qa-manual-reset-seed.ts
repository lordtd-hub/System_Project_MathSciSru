import { PrismaClient } from "@prisma/client";
import {
  MANUAL_DEMO_COURSE_TITLE,
  MANUAL_DEMO_TERM_TYPE,
  MANUAL_DEMO_YEAR_BE,
  manualDemoAdmin,
  manualDemoStudents,
  manualDemoTeachers
} from "../src/lib/qa/manualDemo";
import { courseLevelRoundTypes, defaultCourseRoundName, defaultCourseRoundWeight } from "../src/lib/assessments/courseRounds";
import { termDisplayName } from "../src/lib/terms/display";

const prisma = new PrismaClient();

const CONFIRM_VALUE = "RESET_QA_FOR_MANUAL_GUIDE";

function assertQaManualResetAllowed() {
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing to reset data when VERCEL_ENV=production.");
  }

  if (process.env.QA_MANUAL_RESET_CONFIRM !== CONFIRM_VALUE) {
    throw new Error(`Set QA_MANUAL_RESET_CONFIRM=${CONFIRM_VALUE} to reset QA manual demo data.`);
  }

  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing.");
  }

  if (process.env.QA_MANUAL_ALLOW_REMOTE_RESET !== "1" && !databaseUrl.includes("localhost") && !databaseUrl.includes("127.0.0.1")) {
    throw new Error("Remote database reset requires QA_MANUAL_ALLOW_REMOTE_RESET=1.");
  }
}

function teacherKey(input: { academicPrefix: string; firstNameTh: string; lastNameTh: string }) {
  return `${input.academicPrefix}|${input.firstNameTh}|${input.lastNameTh}`;
}

async function resetQaDataPreservingManualTeachers() {
  const preservedTeacherKeys = new Set(manualDemoTeachers.map(teacherKey));
  const allTeachers = await prisma.teacher.findMany({
    select: { id: true, academicPrefix: true, firstNameTh: true, lastNameTh: true }
  });
  const preservedTeacherIds = allTeachers
    .filter((teacher) => preservedTeacherKeys.has(teacherKey(teacher)))
    .map((teacher) => teacher.id);
  const removableTeacherIds = allTeachers
    .filter((teacher) => !preservedTeacherKeys.has(teacherKey(teacher)))
    .map((teacher) => teacher.id);

  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.scoreItem.deleteMany(),
    prisma.proposalEvaluatorDecision.deleteMany(),
    prisma.scoreSubmission.deleteMany(),
    prisma.proposalVote.deleteMany(),
    prisma.evaluatorAssignment.deleteMany(),
    prisma.scoreRelease.deleteMany(),
    prisma.projectProposalResult.deleteMany(),
    prisma.presentationSubmissionVersion.deleteMany(),
    prisma.presentationSubmission.deleteMany(),
    prisma.projectOriginVersion.deleteMany(),
    prisma.projectOrigin.deleteMany(),
    prisma.examScheduleApproval.deleteMany(),
    prisma.examScheduleProposal.deleteMany(),
    prisma.assessmentSubmission.deleteMany(),
    prisma.reportReview.deleteMany(),
    prisma.reportVersion.deleteMany(),
    prisma.advisorScore.deleteMany(),
    prisma.projectRoundException.deleteMany(),
    prisma.committeeAssignment.deleteMany(),
    prisma.advisorRequest.deleteMany(),
    prisma.projectTimelineEvent.deleteMany(),
    prisma.projectStatusHistory.deleteMany(),
    prisma.assessmentAttempt.deleteMany(),
    prisma.project.deleteMany(),
    prisma.assessmentRound.deleteMany(),
    prisma.courseOffering.deleteMany(),
    prisma.term.deleteMany(),
    prisma.academicYear.deleteMany(),
    prisma.studentProfile.deleteMany(),
    prisma.student.deleteMany(),
    prisma.teacherAccountClaim.deleteMany(),
    prisma.teacher.updateMany({ where: { id: { in: preservedTeacherIds } }, data: { userId: null, email: null, active: true } }),
    prisma.teacher.deleteMany({ where: { id: { in: removableTeacherIds } } }),
    prisma.user.deleteMany()
  ]);

  return {
    preservedTeachers: preservedTeacherIds.length,
    removedTeachers: removableTeacherIds.length
  };
}

async function seedManualDemo() {
  const adminUser = await prisma.user.create({
    data: {
      email: manualDemoAdmin.email,
      emailDomain: manualDemoAdmin.email.split("@")[1] ?? null,
      name: manualDemoAdmin.displayName,
      globalRole: "ADMIN",
      googleSub: `manual-demo-admin-${manualDemoAdmin.email}`,
      active: true
    }
  });

  const teacherRecords = [];
  for (const teacher of manualDemoTeachers) {
    const user = await prisma.user.create({
      data: {
        email: teacher.email,
        emailDomain: teacher.email.split("@")[1] ?? null,
        name: `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`,
        globalRole: "TEACHER",
        googleSub: `manual-demo-teacher-${teacher.index}`,
        active: true
      }
    });

    const teacherRecord = await prisma.teacher.upsert({
      where: {
        academicPrefix_firstNameTh_lastNameTh: {
          academicPrefix: teacher.academicPrefix,
          firstNameTh: teacher.firstNameTh,
          lastNameTh: teacher.lastNameTh
        }
      },
      create: {
        academicPrefix: teacher.academicPrefix,
        firstNameTh: teacher.firstNameTh,
        lastNameTh: teacher.lastNameTh,
        email: teacher.email,
        userId: user.id,
        department: "Mathematics",
        isInternal: true,
        active: true,
        canEvaluateProposal: true
      },
      update: {
        email: teacher.email,
        userId: user.id,
        department: "Mathematics",
        isInternal: true,
        active: true,
        canEvaluateProposal: true
      }
    });
    teacherRecords.push(teacherRecord);
  }

  const academicYear = await prisma.academicYear.create({
    data: { yearBe: MANUAL_DEMO_YEAR_BE, active: true }
  });
  const term = await prisma.term.create({
    data: {
      academicYearId: academicYear.id,
      termType: MANUAL_DEMO_TERM_TYPE,
      displayName: termDisplayName(MANUAL_DEMO_TERM_TYPE, MANUAL_DEMO_YEAR_BE),
      status: "ACTIVE"
    }
  });
  const offering = await prisma.courseOffering.create({
    data: {
      termId: term.id,
      courseTitle: MANUAL_DEMO_COURSE_TITLE,
      status: "ACTIVE"
    }
  });

  for (const roundType of courseLevelRoundTypes) {
    await prisma.assessmentRound.create({
      data: {
        courseOfferingId: offering.id,
        roundType,
        name: defaultCourseRoundName(roundType),
        courseWeight: defaultCourseRoundWeight(roundType),
        rawScoreMax: 100,
        status: "DRAFT",
        showEvaluatorNameToStudent: roundType !== "PROPOSAL"
      }
    });
  }

  for (const student of manualDemoStudents) {
    const user = await prisma.user.create({
      data: {
        email: student.email,
        emailDomain: student.email.split("@")[1] ?? null,
        name: `${student.firstNameTh} ${student.lastNameTh}`,
        globalRole: "STUDENT",
        googleSub: `manual-demo-student-${student.index}`,
        active: true
      }
    });
    const studentRecord = await prisma.student.create({
      data: {
        userId: user.id,
        studentCode: student.studentCode,
        firstNameTh: student.firstNameTh,
        lastNameTh: student.lastNameTh,
        generatedEmail: student.email,
        active: true
      }
    });
    await prisma.project.create({
      data: {
        courseOfferingId: offering.id,
        studentId: studentRecord.id,
        status: "STUDENT_PROFILE"
      }
    });
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: adminUser.id,
      action: "QA_MANUAL_DEMO_RESET_SEEDED",
      entityType: "CourseOffering",
      entityId: offering.id,
      metadataJson: {
        courseTitle: MANUAL_DEMO_COURSE_TITLE,
        teacherCount: teacherRecords.length,
        studentCount: manualDemoStudents.length
      }
    }
  });

  return {
    offeringId: offering.id,
    teachers: teacherRecords.length,
    students: manualDemoStudents.length
  };
}

async function main() {
  assertQaManualResetAllowed();
  console.log("Resetting QA data for manual guide. Production is refused by script guard.");
  const reset = await resetQaDataPreservingManualTeachers();
  const seeded = await seedManualDemo();
  console.log(JSON.stringify({ reset, seeded }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
