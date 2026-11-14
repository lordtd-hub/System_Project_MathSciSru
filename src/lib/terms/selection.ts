import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { chooseStaffOffering, compareAcademicOfferings, COURSE_CONTEXT_ANCHOR_COOKIE } from "./staffSelection";

export const STUDENT_PROJECT_COOKIE = "selected-student-project";
export const COURSE_OFFERING_COOKIE = "selected-course-offering";
export function chooseStudentProject<T extends { id: string; courseOffering: { id: string; status: string; courseCode?: string | null; section?: string | null; term: { id: string; termType: string; academicYear: { yearBe: number } } } }>(projects: T[], selectedId?: string) {
  const active = projects.filter(project => project.courseOffering.status === "ACTIVE")
    .sort((a, b) => compareAcademicOfferings(a.courseOffering, b.courseOffering) || b.id.localeCompare(a.id));
  return active.find(project => project.id === selectedId) ?? active[0] ?? null;
}

export const getStudentProjectChoices = cache(async (email: string) => {
  const student = await prisma.student.findUnique({
    where: { generatedEmail: email.trim().toLowerCase() },
    select: { id: true, active: true, projects: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: {
      id: true, status: true, academicResult: { select: { status: true, originalGrade: true, resolutionGrade: true } },
      courseOffering: { include: { term: { include: { academicYear: true } } } }
    } } }
  });
  const projects = student?.active ? student.projects : [];
  return { studentId: student?.id, projects: projects.filter(project => project.courseOffering.status === "ACTIVE"), history: projects.filter(project => project.courseOffering.status !== "ACTIVE"), selected: chooseStudentProject(projects, (await cookies()).get(STUDENT_PROJECT_COOKIE)?.value) };
});

export async function selectedStudentProjectWhere(email: string) {
  const choices = await getStudentProjectChoices(email);
  // A browser cookie only selects a view. Ownership is always part of the query.
  return { id: choices.selected?.id ?? "__no_owned_project__", studentId: choices.studentId ?? "__no_student__" };
}

export const getCourseOfferingChoices = cache(async () => (await prisma.courseOffering.findMany({
  include: { term: { include: { academicYear: true } }, _count: { select: { projects: { where: { academicResult: { status: "INCOMPLETE" } } } } } },
  orderBy: [{ term: { createdAt: "desc" } }, { id: "desc" }]
})).sort(compareAcademicOfferings));
export const selectedOfferingId = cache(async () => {
  const offerings = await getCourseOfferingChoices();
  const jar = await cookies();
  return chooseStaffOffering(offerings, jar.get(COURSE_OFFERING_COOKIE)?.value, jar.get(COURSE_CONTEXT_ANCHOR_COOKIE)?.value)?.id ?? "__no_offering__";
});
