"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { prisma } from "@/lib/db";
import { COURSE_OFFERING_COOKIE, STUDENT_PROJECT_COOKIE, getCourseOfferingChoices } from "@/lib/terms/selection";
import { COURSE_CONTEXT_ANCHOR_COOKIE, defaultStaffOffering } from "@/lib/terms/staffSelection";
import { getTeacherOfferingChoices, TEACHER_COURSE_COOKIE } from "@/lib/terms/teacherSelection";

export async function selectAcademicContext(form: FormData) {
  const session = await auth();
  const id = String(form.get("context_id") ?? "");
  const mode = String(form.get("view_role") ?? "");
  if (!session?.user.id || !id) throw new Error("ไม่อนุญาต");
  if (session.user.role === "STUDENT" && session.user.email) {
    const project = await prisma.project.findFirst({ where: { id, courseOffering: { status: "ACTIVE" }, student: { active: true, generatedEmail: session.user.email.toLowerCase() } }, select: { id: true } });
    if (!project) throw new Error("ไม่พบโครงงานของบัญชีนี้");
    (await cookies()).set(STUDENT_PROJECT_COOKIE, project.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
    redirect("/student");
  }
  if (mode === "TEACHER" || session.user.role !== "ADMIN") {
    if (!hasApprovedTeacherCapability(session.user)) throw new Error("ไม่อนุญาต");
    const current = await getTeacherOfferingChoices(session.user.id);
    if (!current.offerings.some(offering => offering.id === id)) throw new Error("เลือกได้เฉพาะรายวิชาปัจจุบันที่ท่านเกี่ยวข้อง");
    (await cookies()).set(TEACHER_COURSE_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
    redirect("/teacher");
  }
  if (!await prisma.courseOffering.findUnique({ where: { id }, select: { id: true } })) throw new Error("ไม่พบรายวิชา");
  (await cookies()).set(COURSE_OFFERING_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  const current = defaultStaffOffering(await getCourseOfferingChoices());
  if (current) (await cookies()).set(COURSE_CONTEXT_ANCHOR_COOKIE, current.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  redirect(session.user.role === "ADMIN" ? "/admin" : "/teacher");
}
