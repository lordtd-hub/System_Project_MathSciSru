"use server";

import { cookies } from "next/headers";
import { redirectWithQuery } from "@/lib/navigation/redirectWithQuery";
import { prisma } from "@/lib/db";
import { DEV_SESSION_COOKIE, encodeDevSession, getDevSessionCookieOptions, type DevSessionPayload } from "@/lib/auth/devSession";
import {
  buildQaSessionPayload,
  getQaAdminEmail,
  getQaAdminOptions,
  getQaRoleDashboardPath,
  getQaRoleEmail,
  getQaStudentEmail,
  getQaTeacherEmail,
  getQaTeacherOptions,
  hasQaLoginSecret,
  isQaLoginEnabled,
  parseQaRole,
  qaPilotAdmin,
  qaPilotStudents,
  qaPilotTeachers,
  verifyQaLoginSecret
} from "@/lib/auth/qaLogin";
import { assertRateLimit, pilotRateLimits } from "@/lib/security/rateLimit";
import { teacherDisplayName } from "@/lib/teachers/displayName";
import {
  MULTI_PILOT_R2_COURSE_TITLE,
  MULTI_PILOT_R2_TERM_TYPE,
  MULTI_PILOT_R2_YEAR_BE,
  multiPilotR2Admin,
  multiPilotR2Students,
  multiPilotR2Teachers
} from "@/lib/qa/multiPilotR2";
import { courseLevelRoundTypes, defaultCourseRoundName, defaultCourseRoundWeight } from "@/lib/assessments/courseRounds";

function qaError(error: string): never {
  redirectWithQuery("/qa-login", { error });
}

const qaTeacherProfileNames = new Map(qaPilotTeachers.map((teacher, index) => {
  const suffix = ["A", "B", "C", "Delta"][index] ?? `${index + 1}`;
  return [teacher.email, {
    academicPrefix: "อ.",
    firstNameTh: "QA Teacher",
    lastNameTh: suffix
  }];
}));

async function upsertMultiPilotR2Teacher(teacher: (typeof multiPilotR2Teachers)[number]) {
  const existing = await prisma.teacher.findUnique({ where: { email: teacher.email }, select: { id: true } });
  if (existing) {
    await prisma.teacher.update({
      where: { id: existing.id },
      data: { active: true, canEvaluateProposal: true, isInternal: true }
    });
    return;
  }

  await prisma.teacher.upsert({
    where: {
      academicPrefix_firstNameTh_lastNameTh: {
        academicPrefix: teacher.academicPrefix,
        firstNameTh: teacher.firstNameTh,
        lastNameTh: teacher.lastNameTh
      }
    },
    update: {
      email: teacher.email,
      department: "Mathematics",
      active: true,
      canEvaluateProposal: true,
      isInternal: true
    },
    create: {
      academicPrefix: teacher.academicPrefix,
      firstNameTh: teacher.firstNameTh,
      lastNameTh: teacher.lastNameTh,
      email: teacher.email,
      department: "Mathematics",
      active: true,
      canEvaluateProposal: true,
      isInternal: true
    }
  });
}

async function setQaSession(payload: DevSessionPayload) {
  const cookieStore = await cookies();
  clearRealAuthCookies(cookieStore);
  cookieStore.set(DEV_SESSION_COOKIE, encodeDevSession(payload), getDevSessionCookieOptions());
}

function clearRealAuthCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  for (const cookie of cookieStore.getAll()) {
    if (
      cookie.name.startsWith("authjs.") ||
      cookie.name.startsWith("__Secure-authjs.") ||
      cookie.name.startsWith("next-auth.") ||
      cookie.name.startsWith("__Secure-next-auth.")
    ) {
      cookieStore.delete(cookie.name);
    }
  }
}

export async function selectQaUser(formData: FormData) {
  assertRateLimit("qa-login:select-user", pilotRateLimits.devLogin);

  if (!isQaLoginEnabled()) qaError("QA login is disabled for this environment.");
  if (!hasQaLoginSecret()) qaError("QA_LOGIN_SECRET is not configured.");
  if (!verifyQaLoginSecret(String(formData.get("secret") ?? ""))) qaError("QA login secret is incorrect.");

  const role = parseQaRole(formData.get("role"));
  if (!role) qaError("Please select a valid QA role.");

  const email = role === "teacher" ? undefined : role === "student" ? getQaStudentEmail(formData.get("student_email")) : getQaAdminEmail(formData.get("admin_email")) ?? getQaRoleEmail(role);
  if (role !== "teacher" && !email) qaError(`Missing QA email configuration for ${role}.`);

  if (role === "student") {
    const student = await prisma.student.findUnique({
      where: { generatedEmail: email! },
      select: { id: true, studentCode: true, firstNameTh: true, lastNameTh: true, generatedEmail: true }
    });
    if (!student) qaError("QA student is not in the roster. Prepare QA pilot identities first.");

    const user = await prisma.user.upsert({
      where: { email: email! },
      update: { globalRole: "STUDENT", active: true, name: `${student.firstNameTh} ${student.lastNameTh}` },
      create: {
        email: email!,
        emailDomain: email!.split("@")[1] ?? null,
        globalRole: "STUDENT",
        active: true,
        name: `${student.firstNameTh} ${student.lastNameTh}`,
        googleSub: `qa-student-${student.studentCode}`
      }
    });
    await prisma.student.update({ where: { id: student.id }, data: { userId: user.id } });
    await setQaSession(buildQaSessionPayload({
      role,
      userId: user.id,
      email: email!,
      name: user.name ?? `${student.firstNameTh} ${student.lastNameTh}`
    }));
  }

  if (role === "teacher") {
    const teacherEmail = getQaTeacherEmail(formData.get("teacher_email"));
    if (!teacherEmail) qaError("Missing QA teacher email configuration.");
    const teacher = await prisma.teacher.findFirst({
      where: { email: teacherEmail, active: true },
      select: { id: true, academicPrefix: true, firstNameTh: true, lastNameTh: true, email: true }
    });
    if (!teacher) qaError("QA teacher profile is missing or inactive. Prepare QA pilot identities first.");

    const name = teacherDisplayName(teacher);
    const user = await prisma.user.upsert({
      where: { email: teacherEmail },
      update: { globalRole: "TEACHER", active: true, name },
      create: {
        email: teacherEmail,
        emailDomain: teacherEmail.split("@")[1] ?? null,
        globalRole: "TEACHER",
        active: true,
        name,
        googleSub: `qa-teacher-${teacher.id}`
      }
    });
    await prisma.teacher.update({ where: { id: teacher.id }, data: { userId: user.id } });
    await setQaSession(buildQaSessionPayload({ role, userId: user.id, email: teacherEmail, name, teacherId: teacher.id }));
  }

  if (role === "admin") {
    const adminDisplayName = getQaAdminOptions().find((option) => option.email === email)?.displayName ?? qaPilotAdmin.displayName;
    const linkedTeacher = await prisma.teacher.findFirst({
      where: { email: email!, active: true },
      select: { id: true }
    });
    const user = await prisma.user.upsert({
      where: { email: email! },
      update: { globalRole: "ADMIN", active: true, name: adminDisplayName },
      create: {
        email: email!,
        emailDomain: email!.split("@")[1] ?? null,
        globalRole: "ADMIN",
        active: true,
        name: adminDisplayName,
        googleSub: `qa-admin-${email!}`
      }
    });
    if (linkedTeacher) {
      await prisma.teacher.update({ where: { id: linkedTeacher.id }, data: { userId: user.id } });
    }
    await setQaSession(buildQaSessionPayload({
      role,
      userId: user.id,
      email: email!,
      name: user.name ?? adminDisplayName,
      teacherId: linkedTeacher?.id ?? null
    }));
  }

  redirectWithQuery(getQaRoleDashboardPath(role), { success: "qa_login" });
}

async function upsertQaTeacher(option: ReturnType<typeof getQaTeacherOptions>[number], index: number) {
  const identity = qaTeacherProfileNames.get(option.email) ?? { academicPrefix: "อ.", firstNameTh: "QA Legacy", lastNameTh: `${index + 1}` };
  const existing = await prisma.teacher.findUnique({ where: { email: option.email }, select: { id: true } });
  if (existing) {
    await prisma.teacher.update({
      where: { id: existing.id },
      data: { active: true, canEvaluateProposal: true, isInternal: true }
    });
    return;
  }

  await prisma.teacher.upsert({
    where: {
      academicPrefix_firstNameTh_lastNameTh: {
        academicPrefix: identity.academicPrefix,
        firstNameTh: identity.firstNameTh,
        lastNameTh: identity.lastNameTh
      }
    },
    update: {
      email: option.email,
      department: "Mathematics",
      active: true,
      canEvaluateProposal: true,
      isInternal: true
    },
    create: {
      academicPrefix: identity.academicPrefix,
      firstNameTh: identity.firstNameTh,
      lastNameTh: identity.lastNameTh,
      email: option.email,
      department: "Mathematics",
      active: true,
      canEvaluateProposal: true,
      isInternal: true
    }
  });
}

export async function prepareQaTeacherProfiles(formData: FormData) {
  assertRateLimit("qa-login:prepare-teachers", pilotRateLimits.devLogin);

  if (!isQaLoginEnabled()) qaError("QA login is disabled for this environment.");
  if (!hasQaLoginSecret()) qaError("QA_LOGIN_SECRET is not configured.");
  if (!verifyQaLoginSecret(String(formData.get("secret") ?? ""))) qaError("QA login secret is incorrect.");

  const options = getQaTeacherOptions();
  if (options.length < 3) qaError("Set at least three QA teacher emails for advisor and committee testing.");

  await Promise.all(options.slice(0, 8).map(upsertQaTeacher));

  redirectWithQuery("/qa-login", { success: "qa_teachers_prepared" });
}

export async function prepareQaPilotIdentities(formData: FormData) {
  assertRateLimit("qa-login:prepare-pilot-identities", pilotRateLimits.devLogin);

  if (!isQaLoginEnabled()) qaError("QA login is disabled for this environment.");
  if (!hasQaLoginSecret()) qaError("QA_LOGIN_SECRET is not configured.");
  if (!verifyQaLoginSecret(String(formData.get("secret") ?? ""))) qaError("QA login secret is incorrect.");

  await prisma.user.upsert({
    where: { email: qaPilotAdmin.email },
    update: { globalRole: "ADMIN", active: true, name: qaPilotAdmin.displayName },
    create: {
      email: qaPilotAdmin.email,
      emailDomain: qaPilotAdmin.email.split("@")[1] ?? null,
      globalRole: "ADMIN",
      active: true,
      name: qaPilotAdmin.displayName,
      googleSub: `qa-admin-${qaPilotAdmin.email}`
    }
  });

  const students = await Promise.all(qaPilotStudents.map((student) => prisma.student.upsert({
    where: { generatedEmail: student.email },
    update: {
      studentCode: student.studentCode,
      firstNameTh: student.firstNameTh,
      lastNameTh: student.lastNameTh,
      active: true
    },
    create: {
      studentCode: student.studentCode,
      firstNameTh: student.firstNameTh,
      lastNameTh: student.lastNameTh,
      generatedEmail: student.email,
      active: true
    }
  })));

  const latestCourseOffering = await prisma.courseOffering.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true }
  }) ?? await prisma.courseOffering.findFirst({ select: { id: true } });
  if (!latestCourseOffering) qaError("Create a course offering before preparing QA pilot identities.");

  await Promise.all(students.map((student) => prisma.project.upsert({
    where: { courseOfferingId_studentId: { courseOfferingId: latestCourseOffering.id, studentId: student.id } },
    update: {},
    create: {
      courseOfferingId: latestCourseOffering.id,
      studentId: student.id,
      status: "STUDENT_PROFILE"
    }
  })));

  await Promise.all(getQaTeacherOptions().slice(0, 8).map(upsertQaTeacher));

  redirectWithQuery("/qa-login", { success: "qa_pilot_identities_prepared" });
}

export async function prepareMultiPilotR2Data(formData: FormData) {
  assertRateLimit("qa-login:prepare-multi-pilot-r2", pilotRateLimits.devLogin);

  if (!isQaLoginEnabled()) qaError("QA login is disabled for this environment.");
  if (!hasQaLoginSecret()) qaError("QA_LOGIN_SECRET is not configured.");
  if (!verifyQaLoginSecret(String(formData.get("secret") ?? ""))) qaError("QA login secret is incorrect.");

  await prisma.user.upsert({
    where: { email: multiPilotR2Admin.email },
    update: { globalRole: "ADMIN", active: true, name: multiPilotR2Admin.displayName },
    create: {
      email: multiPilotR2Admin.email,
      emailDomain: multiPilotR2Admin.email.split("@")[1] ?? null,
      globalRole: "ADMIN",
      active: true,
      name: multiPilotR2Admin.displayName,
      googleSub: `qa-admin-${multiPilotR2Admin.email}`
    }
  });

  const academicYear = await prisma.academicYear.upsert({
    where: { yearBe: MULTI_PILOT_R2_YEAR_BE },
    update: { active: true },
    create: { yearBe: MULTI_PILOT_R2_YEAR_BE, active: true }
  });
  const term = await prisma.term.upsert({
    where: { academicYearId_termType: { academicYearId: academicYear.id, termType: MULTI_PILOT_R2_TERM_TYPE } },
    update: { displayName: "MULTI-PILOT-R2 Semester 1 BE 2570", status: "ACTIVE" },
    create: {
      academicYearId: academicYear.id,
      termType: MULTI_PILOT_R2_TERM_TYPE,
      displayName: "MULTI-PILOT-R2 Semester 1 BE 2570",
      status: "ACTIVE"
    }
  });

  const existingOffering = await prisma.courseOffering.findFirst({
    where: { termId: term.id, courseTitle: MULTI_PILOT_R2_COURSE_TITLE },
    select: { id: true }
  });
  const offering = existingOffering
    ? await prisma.courseOffering.update({ where: { id: existingOffering.id }, data: { status: "ACTIVE" }, select: { id: true } })
    : await prisma.courseOffering.create({ data: { termId: term.id, courseTitle: MULTI_PILOT_R2_COURSE_TITLE, status: "ACTIVE" }, select: { id: true } });

  for (const roundType of courseLevelRoundTypes) {
    await prisma.assessmentRound.upsert({
      where: { courseOfferingId_roundType: { courseOfferingId: offering.id, roundType } },
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

  const students = await Promise.all(multiPilotR2Students.map((student) => prisma.student.upsert({
    where: { generatedEmail: student.email },
    update: {
      studentCode: student.studentCode,
      firstNameTh: student.firstNameTh,
      lastNameTh: student.lastNameTh,
      active: true
    },
    create: {
      studentCode: student.studentCode,
      firstNameTh: student.firstNameTh,
      lastNameTh: student.lastNameTh,
      generatedEmail: student.email,
      active: true
    }
  })));

  await Promise.all(students.map((student) => prisma.project.upsert({
    where: { courseOfferingId_studentId: { courseOfferingId: offering.id, studentId: student.id } },
    update: {},
    create: {
      courseOfferingId: offering.id,
      studentId: student.id,
      status: "STUDENT_PROFILE"
    }
  })));

  await Promise.all(multiPilotR2Teachers.map(upsertMultiPilotR2Teacher));

  redirectWithQuery("/qa-login", { success: "multi_pilot_r2_prepared" });
}

export async function clearQaUser() {
  if (!isQaLoginEnabled()) qaError("QA login is disabled for this environment.");
  const cookieStore = await cookies();
  clearRealAuthCookies(cookieStore);
  cookieStore.delete(DEV_SESSION_COOKIE);
  redirectWithQuery("/qa-login", { success: "signed_out" });
}
