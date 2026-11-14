"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { prisma } from "@/lib/db";
import { COURSE_OFFERING_COOKIE, STUDENT_PROJECT_COOKIE } from "@/lib/terms/selection";

export async function selectAcademicContext(form: FormData) {
  const session = await auth();
  const id = String(form.get("context_id") ?? "");
  if (!session?.user.id || !id) throw new Error("ไม่อนุญาต");
  if (session.user.role === "STUDENT" && session.user.email) {
    const project = await prisma.project.findFirst({ where: { id, student: { active: true, generatedEmail: session.user.email.toLowerCase() } }, select: { id: true } });
    if (!project) throw new Error("ไม่พบโครงงานของบัญชีนี้");
    (await cookies()).set(STUDENT_PROJECT_COOKIE, project.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
    redirect("/student");
  }
  if (session.user.role !== "ADMIN" && !hasApprovedTeacherCapability(session.user)) throw new Error("ไม่อนุญาต");
  if (!await prisma.courseOffering.findUnique({ where: { id }, select: { id: true } })) throw new Error("ไม่พบรายวิชา");
  (await cookies()).set(COURSE_OFFERING_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  redirect(session.user.role === "ADMIN" ? "/admin" : "/teacher");
}
