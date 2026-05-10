"use server";

import { cookies } from "next/headers";
import { redirectWithQuery } from "@/lib/navigation/redirectWithQuery";
import { prisma } from "@/lib/db";
import { DEV_SESSION_COOKIE, encodeDevSession, getDevSessionCookieOptions, type DevSessionPayload } from "@/lib/auth/devSession";
import {
  buildQaSessionPayload,
  getQaRoleDashboardPath,
  getQaRoleEmail,
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

  const email = getQaRoleEmail(role);
  if (!email) qaError(`Missing QA email configuration for ${role}.`);

  if (role === "student") {
    const student = await prisma.student.findUnique({
      where: { generatedEmail: email },
      select: { id: true, studentCode: true, firstNameTh: true, lastNameTh: true, generatedEmail: true }
    });
    if (!student) qaError("QA student is not in the roster. Import the student first.");

    const user = await prisma.user.upsert({
      where: { email },
      update: { globalRole: "STUDENT", active: true, name: `${student.firstNameTh} ${student.lastNameTh}` },
      create: {
        email,
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
      email,
      name: user.name ?? `${student.firstNameTh} ${student.lastNameTh}`
    }));
  }

  if (role === "teacher") {
    const teacher = await prisma.teacher.findFirst({
      where: { email, active: true },
      select: { id: true, academicPrefix: true, firstNameTh: true, lastNameTh: true, email: true }
    });
    if (!teacher) qaError("QA teacher profile is missing or inactive. Link the teacher email first.");

    const name = teacherDisplayName(teacher);
    const user = await prisma.user.upsert({
      where: { email },
      update: { globalRole: "TEACHER", active: true, name },
      create: {
        email,
        emailDomain: "sru.ac.th",
        globalRole: "TEACHER",
        active: true,
        name,
        googleSub: `qa-teacher-${teacher.id}`
      }
    });
    await prisma.teacher.update({ where: { id: teacher.id }, data: { userId: user.id } });
    await setQaSession(buildQaSessionPayload({ role, userId: user.id, email, name, teacherId: teacher.id }));
  }

  if (role === "admin") {
    const linkedTeacher = await prisma.teacher.findFirst({
      where: { email, active: true },
      select: { id: true }
    });
    const user = await prisma.user.upsert({
      where: { email },
      update: { globalRole: "ADMIN", active: true, name: "QA Admin" },
      create: {
        email,
        emailDomain: email.split("@")[1] ?? null,
        globalRole: "ADMIN",
        active: true,
        name: "QA Admin",
        googleSub: `qa-admin-${email}`
      }
    });
    if (linkedTeacher) {
      await prisma.teacher.update({ where: { id: linkedTeacher.id }, data: { userId: user.id } });
    }
    await setQaSession(buildQaSessionPayload({
      role,
      userId: user.id,
      email,
      name: user.name ?? "QA Admin",
      teacherId: linkedTeacher?.id ?? null
    }));
  }

  redirectWithQuery(getQaRoleDashboardPath(role), { success: "qa_login" });
}

export async function clearQaUser() {
  if (!isQaLoginEnabled()) qaError("QA login is disabled for this environment.");
  const cookieStore = await cookies();
  clearRealAuthCookies(cookieStore);
  cookieStore.delete(DEV_SESSION_COOKIE);
  redirectWithQuery("/qa-login", { success: "signed_out" });
}
