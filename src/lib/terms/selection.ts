import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const STUDENT_PROJECT_COOKIE = "selected-student-project";
export const COURSE_OFFERING_COOKIE = "selected-course-offering";
export function chooseStudentProject<T extends { id: string; academicResult?: { status: string } | null }>(projects: T[], selectedId?: string) {
  return projects.find(project => project.id === selectedId)
    ?? projects.find(project => project.academicResult?.status === "INCOMPLETE")
    ?? projects[0] ?? null;
}

export const getStudentProjectChoices = cache(async (email: string) => {
  const student = await prisma.student.findUnique({
    where: { generatedEmail: email.trim().toLowerCase() },
    select: { id: true, active: true, projects: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: {
      id: true, status: true, academicResult: { select: { status: true, originalGrade: true, resolutionGrade: true } },
      courseOffering: { include: { term: true } }
    } } }
  });
  const projects = student?.active ? student.projects : [];
  return { studentId: student?.id, projects, selected: chooseStudentProject(projects, (await cookies()).get(STUDENT_PROJECT_COOKIE)?.value) };
});

export async function selectedStudentProjectWhere(email: string) {
  const choices = await getStudentProjectChoices(email);
  // A browser cookie only selects a view. Ownership is always part of the query.
  return { id: choices.selected?.id ?? "__no_owned_project__", studentId: choices.studentId ?? "__no_student__" };
}

export const getCourseOfferingChoices = cache(async () => prisma.courseOffering.findMany({
  include: { term: true, _count: { select: { projects: { where: { academicResult: { status: "INCOMPLETE" } } } } } },
  orderBy: [{ term: { createdAt: "desc" } }, { id: "desc" }]
}));
export const selectedOfferingId = cache(async () => {
  const offerings = await getCourseOfferingChoices();
  const selected = (await cookies()).get(COURSE_OFFERING_COOKIE)?.value;
  return offerings.find(offering => offering.id === selected)?.id
    ?? offerings.find(offering => offering.status === "ACTIVE")?.id
    ?? offerings[0]?.id ?? "__no_offering__";
});
