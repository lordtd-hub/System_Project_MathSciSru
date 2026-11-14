import { cache } from "react";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { compareAcademicOfferings } from "./staffSelection";
export const TEACHER_COURSE_COOKIE = "selected-teacher-current-course";

export const getTeacherOfferingChoices = cache(async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { active: true, globalRole: true } });
  if (!user?.active || !["ADMIN", "TEACHER"].includes(user.globalRole)) return { offerings: [], current: null, selected: null };
  const teacher = await prisma.teacher.findUnique({ where: { userId }, select: { id: true, active: true } });
  const active = (await prisma.courseOffering.findMany({ where: { status: "ACTIVE" }, include: { term: { include: { academicYear: true } }, _count: { select: { projects: true } } } })).sort(compareAcademicOfferings);
  // No fallback into a closed course, even when the teacher has old assignments.
  if (!teacher?.active || !active.length) return { offerings: [], current: active[0] ?? null, selected: null };
  const offerings = await prisma.courseOffering.findMany({ where: {
    id: { in: active.map(o => o.id) }, projects: { some: { OR: [
      { committeeAssignments: { some: { teacherId: teacher.id, active: true } } },
      { advisorRequests: { some: { advisorTeacherId: teacher.id, status: { in: ["PENDING", "APPROVED"] } } } },
      { attempts: { some: { evaluatorAssignments: { some: { evaluatorUserId: userId } } } } }
    ] } }
  }, include: { term: { include: { academicYear: true } }, _count: { select: { projects: true } } } });
  offerings.sort(compareAcademicOfferings);
  const selectedId = (await cookies()).get(TEACHER_COURSE_COOKIE)?.value;
  return { offerings, current: active[0] ?? null, selected: offerings.find(o => o.id === selectedId) ?? offerings[0] ?? null };
});
export const selectedTeacherOfferingId = cache(async () => {
  const session = await auth();
  return session?.user.id ? (await getTeacherOfferingChoices(session.user.id)).selected?.id ?? "__no_related_active_offering__" : "__no_related_active_offering__";
});
