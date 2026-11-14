import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { advisorHistoryWhere, historySearchWhere } from "@/lib/projects/history";
import { ProjectHistoryList } from "@/components/ui/ProjectHistoryList";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function AdvisorHistoryPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const session = await auth();
  const user = session?.user.id ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { active: true, globalRole: true, teacher: { select: { id: true, active: true } } } }) : null;
  if (!user?.active || !["ADMIN", "TEACHER"].includes(user.globalRole) || !user.teacher?.active) return <p>หน้านี้สำหรับอาจารย์ที่ได้รับอนุมัติเท่านั้น</p>;
  const q = String((await searchParams)?.q ?? "").slice(0, 100);
  const projects = await prisma.project.findMany({ where: { AND: [advisorHistoryWhere(user.teacher.id), historySearchWhere(q)] },
    include: { student: true, academicResult: true, courseOffering: { include: { term: true } } }, orderBy: [{ courseOffering: { term: { academicYear: { yearBe: "desc" } } } }, { createdAt: "desc" }, { id: "desc" }], take: 100 });
  return <div className="space-y-4"><PageHeader title="งานที่เคยเป็นที่ปรึกษา" description="ประวัติของตนเองแยกจากงานรายวิชาปัจจุบัน" /><ProjectHistoryList projects={projects} search={q} /></div>;
}
