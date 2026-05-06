"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { DEV_SESSION_COOKIE, encodeDevSession, isDevLoginEnabled, type DevSessionPayload } from "@/lib/auth/devSession";
import { teacherDisplayName } from "@/lib/teachers/displayName";

async function setDevSession(payload: DevSessionPayload) {
  if (!isDevLoginEnabled()) throw new Error("Development login is disabled in production");
  const cookieStore = await cookies();
  cookieStore.set(DEV_SESSION_COOKIE, encodeDevSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export async function selectDevUser(formData: FormData) {
  if (!isDevLoginEnabled()) throw new Error("Development login is disabled in production");

  const mode = String(formData.get("mode"));
  let redirectTo = "/";

  if (mode === "admin") {
    const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
    if (!email) throw new Error("INITIAL_ADMIN_EMAIL is required for dev admin login");
    const user = await prisma.user.upsert({
      where: { email },
      update: { globalRole: "ADMIN", active: true, name: "Development Admin" },
      create: {
        email,
        emailDomain: email.split("@")[1] ?? null,
        globalRole: "ADMIN",
        active: true,
        name: "Development Admin",
        googleSub: "dev-admin"
      }
    });
    await setDevSession({ userId: user.id, role: "ADMIN", email, name: user.name ?? "Development Admin" });
    redirectTo = "/admin";
  }

  if (mode === "student") {
    const studentId = String(formData.get("student_id"));
    const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });
    const user = await prisma.user.upsert({
      where: { email: student.generatedEmail },
      update: { globalRole: "STUDENT", active: true, name: `${student.firstNameTh} ${student.lastNameTh}` },
      create: {
        email: student.generatedEmail,
        emailDomain: "student.sru.ac.th",
        globalRole: "STUDENT",
        active: true,
        name: `${student.firstNameTh} ${student.lastNameTh}`,
        googleSub: `dev-student-${student.studentCode}`
      }
    });
    await prisma.student.update({ where: { id: student.id }, data: { userId: user.id } });
    await setDevSession({ userId: user.id, role: "STUDENT", email: student.generatedEmail, name: `${student.firstNameTh} ${student.lastNameTh}` });
    redirectTo = "/student";
  }

  if (mode === "teacher") {
    const teacherId = String(formData.get("teacher_id"));
    const teacher = await prisma.teacher.findUniqueOrThrow({ where: { id: teacherId } });
    const email = teacher.email ?? `dev.teacher.${teacher.id.slice(-6)}@sru.ac.th`;
    const user = await prisma.user.upsert({
      where: { email },
      update: { globalRole: "TEACHER", active: true, name: teacherDisplayName(teacher) },
      create: {
        email,
        emailDomain: "sru.ac.th",
        globalRole: "TEACHER",
        active: true,
        name: teacherDisplayName(teacher),
        googleSub: `dev-teacher-${teacher.id}`
      }
    });
    await prisma.teacher.update({ where: { id: teacher.id }, data: { userId: user.id, email } });
    await setDevSession({ userId: user.id, role: "TEACHER", email, name: teacherDisplayName(teacher) });
    redirectTo = "/teacher";
  }

  if (mode === "pending_teacher") {
    const email = "dev.pending.teacher@sru.ac.th";
    const user = await prisma.user.upsert({
      where: { email },
      update: { globalRole: "PENDING_TEACHER", active: true, name: "อาจารย์รออนุมัติ" },
      create: {
        email,
        emailDomain: "sru.ac.th",
        globalRole: "PENDING_TEACHER",
        active: true,
        name: "อาจารย์รออนุมัติ",
        googleSub: "dev-pending-teacher"
      }
    });
    await setDevSession({ userId: user.id, role: "PENDING_TEACHER", email, name: user.name ?? "อาจารย์รออนุมัติ" });
    redirectTo = "/teacher";
  }

  redirect(redirectTo);
}

export async function clearDevUser() {
  if (!isDevLoginEnabled()) throw new Error("Development login is disabled in production");
  const cookieStore = await cookies();
  cookieStore.delete(DEV_SESSION_COOKIE);
  redirect("/dev-login");
}
