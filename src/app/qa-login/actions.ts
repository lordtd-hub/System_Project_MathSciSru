"use server";

import { cookies } from "next/headers";
import { redirectWithQuery } from "@/lib/navigation/redirectWithQuery";
import { prisma } from "@/lib/db";
import { DEV_SESSION_COOKIE, encodeDevSession, getDevSessionCookieOptions, type DevSessionPayload } from "@/lib/auth/devSession";
import {
  buildQaSessionPayload,
  getQaRoleDashboardPath,
  getQaRoleEmail,
  getQaTeacherEmail,
  getQaTeacherOptions,
  hasQaLoginSecret,
  isQaLoginEnabled,
  parseQaRole,
  verifyQaLoginSecret
} from "@/lib/auth/qaLogin";
import { assertRateLimit, pilotRateLimits } from "@/lib/security/rateLimit";
import { teacherDisplayName } from "@/lib/teachers/displayName";

function qaError(error: string): never {
  redirectWithQuery("/qa-login", { error });
}

const qaTeacherNames = [
  { academicPrefix: "อ.", firstNameTh: "QA", lastNameTh: "ที่ปรึกษา" },
  { academicPrefix: "อ.", firstNameTh: "QA", lastNameTh: "กรรมการหนึ่ง" },
  { academicPrefix: "อ.", firstNameTh: "QA", lastNameTh: "กรรมการสอง" },
  { academicPrefix: "อ.", firstNameTh: "QA", lastNameTh: "กรรมการสำรอง" }
];

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

  const email = role === "teacher" ? undefined : getQaRoleEmail(role);
  if (role !== "teacher" && !email) qaError(`Missing QA email configuration for ${role}.`);

  if (role === "student") {
    const student = await prisma.student.findUnique({
      where: { generatedEmail: email! },
      select: { id: true, studentCode: true, firstNameTh: true, lastNameTh: true, generatedEmail: true }
    });
    if (!student) qaError("QA student is not in the roster. Import the student first.");

    const user = await prisma.user.upsert({
      where: { email: email! },
      update: { globalRole: "STUDENT", active: true, name: `${student.firstNameTh} ${student.lastNameTh}` },
      create: {
        email: email!,
        emailDomain: "student.sru.ac.th",
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
    if (!teacher) qaError("QA teacher profile is missing or inactive. Link the teacher email first.");

    const name = teacherDisplayName(teacher);
    const user = await prisma.user.upsert({
      where: { email: teacherEmail },
      update: { globalRole: "TEACHER", active: true, name },
      create: {
        email: teacherEmail,
        emailDomain: "sru.ac.th",
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
    const linkedTeacher = await prisma.teacher.findFirst({
      where: { email: email!, active: true },
      select: { id: true }
    });
    const user = await prisma.user.upsert({
      where: { email: email! },
      update: { globalRole: "ADMIN", active: true, name: "QA Admin" },
      create: {
        email: email!,
        emailDomain: email!.split("@")[1] ?? null,
        globalRole: "ADMIN",
        active: true,
        name: "QA Admin",
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
      name: user.name ?? "QA Admin",
      teacherId: linkedTeacher?.id ?? null
    }));
  }

  redirectWithQuery(getQaRoleDashboardPath(role), { success: "qa_login" });
}

export async function prepareQaTeacherProfiles(formData: FormData) {
  assertRateLimit("qa-login:prepare-teachers", pilotRateLimits.devLogin);

  if (!isQaLoginEnabled()) qaError("QA login is disabled for this environment.");
  if (!hasQaLoginSecret()) qaError("QA_LOGIN_SECRET is not configured.");
  if (!verifyQaLoginSecret(String(formData.get("secret") ?? ""))) qaError("QA login secret is incorrect.");

  const options = getQaTeacherOptions();
  if (options.length < 3) qaError("Set at least three QA teacher emails for advisor and committee testing.");

  await Promise.all(options.slice(0, 4).map(async (option, index) => {
    const identity = qaTeacherNames[index] ?? { academicPrefix: "อ.", firstNameTh: "QA", lastNameTh: `กรรมการ ${index + 1}` };
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
  }));

  redirectWithQuery("/qa-login", { success: "qa_teachers_prepared" });
}

export async function clearQaUser() {
  if (!isQaLoginEnabled()) qaError("QA login is disabled for this environment.");
  const cookieStore = await cookies();
  clearRealAuthCookies(cookieStore);
  cookieStore.delete(DEV_SESSION_COOKIE);
  redirectWithQuery("/qa-login", { success: "signed_out" });
}
