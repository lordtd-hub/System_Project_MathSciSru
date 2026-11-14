import type { Prisma } from "@prisma/client";

export function advisorHistoryWhere(teacherId: string): Prisma.ProjectWhereInput {
  return { courseOffering: { status: "CLOSED" }, OR: [
    { advisorRequests: { some: { advisorTeacherId: teacherId, status: "APPROVED" } } },
    { committeeAssignments: { some: { teacherId, role: "ADVISOR" } } },
    { advisorScore: { advisorTeacherId: teacherId } }
  ] };
}
export function historySearchWhere(value: string): Prisma.ProjectWhereInput {
  const search = value.trim().slice(0, 100);
  return search ? { OR: [
    { currentTitleTh: { contains: search, mode: "insensitive" } },
    { student: { studentCode: { contains: search } } },
    { student: { firstNameTh: { contains: search } } },
    { student: { lastNameTh: { contains: search } } },
    { courseOffering: { courseCode: { contains: search, mode: "insensitive" } } },
    { courseOffering: { term: { displayName: { contains: search } } } }
  ] } : {};
}
