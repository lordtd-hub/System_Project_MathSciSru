import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { historySearchWhere } from "@/lib/projects/history";
import { ProjectHistoryList } from "@/components/ui/ProjectHistoryList";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function StudentHistoryPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const session = await auth();
  const user = session?.user.id ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { active: true, globalRole: true, email: true } }) : null;
  if (!user?.active || !user.email || user.globalRole !== "STUDENT") return <p>หน้านี้สำหรับนักศึกษาเท่านั้น</p>;
  const q = String((await searchParams)?.q ?? "").slice(0, 100);
  const projects = await prisma.project.findMany({ where: { AND: [
    { student: { generatedEmail: user.email.toLowerCase(), active: true }, courseOffering: { status: { not: "ACTIVE" } } }, historySearchWhere(q)
  ] }, include: { student: true, academicResult: true, courseOffering: { include: { term: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 });
  return <div className="space-y-4"><PageHeader title="ประวัติโครงงาน / ผล I" description="งานเดิมของตนเองยังคงอยู่ แยกจากรายวิชาที่เปิดเรียน" /><ProjectHistoryList projects={projects} search={q} /></div>;
}
