import Link from "next/link";
import { auth } from "@/auth";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
import { getCompletionEligibility, type CompletionEligibility } from "@/lib/lifecycle/completionEligibility";
import { completeProjectCloseout } from "../actions";

type CloseoutProject = {
  id: string;
  currentTitleTh: string | null;
  status: "REPORT_APPROVED" | "ADVISOR_SCORING" | "COMPLETED";
  student: {
    studentCode: string;
    firstNameTh: string;
    lastNameTh: string;
  };
};

function ChecklistRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paperSoft px-3 py-2 text-sm">
      <span>{label}</span>
      <span className={done ? "font-semibold text-[var(--ok-700)]" : "font-semibold text-[var(--warn-700)]"}>{done ? "ครบแล้ว" : "ยังไม่ครบ"}</span>
    </div>
  );
}

function CloseoutCard({ project, eligibility }: { project: CloseoutProject; eligibility: CompletionEligibility }) {
  const completed = project.status === "COMPLETED";
  return (
    <article className="panel space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm text-muted">
            {project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}
          </div>
          <h2 className="mt-1 text-lg font-semibold">{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
        </div>
        <StatusBadge status={project.status} />
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <ChecklistRow label="คะแนนสอบความก้าวหน้าครั้งที่ 1" done={eligibility.hasProgress1Score} />
        <ChecklistRow label="คะแนนสอบความก้าวหน้าครั้งที่ 2" done={eligibility.hasProgress2Score} />
        <ChecklistRow label="คะแนนสอบนำเสนอขั้นสุดท้าย" done={eligibility.hasFinalPresentationScore} />
        <ChecklistRow label="รายงานฉบับสมบูรณ์ผ่านการตรวจ" done={eligibility.hasReachedReportApproved} />
        <ChecklistRow label="คะแนนสรุปของอาจารย์ที่ปรึกษา 25%" done={eligibility.hasAdvisorScore} />
        <ChecklistRow label="ไม่มีคำขอแก้ไขรายงานที่ค้างอยู่" done={!eligibility.hasUnresolvedReportRevision} />
      </div>

      {completed ? (
        <div className="app-alert alert-success text-sm font-medium">โครงงานเสร็จสมบูรณ์แล้ว</div>
      ) : eligibility.eligible ? (
        <form action={completeProjectCloseout} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <input type="hidden" name="project_id" value={project.id} />
          <SubmitButton confirmMessage="ยืนยันว่าโครงงานเสร็จสมบูรณ์หรือไม่? ระบบจะบันทึกประวัติว่าผู้ดูแลระบบตรวจสอบเงื่อนไขครบแล้ว" pendingText="กำลังยืนยัน...">
            ยืนยันจบโครงงาน
          </SubmitButton>
        </form>
      ) : (
        <div className="app-alert alert-warning text-sm">
          <div className="font-semibold">ยังปิดงานไม่ได้</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {eligibility.missingRequirements.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export default async function AdminCloseoutPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return <div className="panel">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div>;
  const params = (await searchParams) ?? {};

  const projects = await prisma.project.findMany({
    where: { status: { in: ["REPORT_APPROVED", "ADVISOR_SCORING", "COMPLETED"] } },
    include: { student: true },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
  });
  const projectCards = await Promise.all(projects.map(async (project) => ({ project, eligibility: await getCompletionEligibility(project.id) })));

  return (
    <div className="space-y-6">
      <PageHeader
        title="ยืนยันจบโครงงาน"
        description="ผู้ดูแลระบบตรวจสอบว่าคะแนนสอบความก้าวหน้า คะแนนสอบขั้นสุดท้าย เล่มรายงาน และคะแนนสรุปของอาจารย์ที่ปรึกษาครบแล้ว ก่อนยืนยันว่าโครงงานเสร็จสมบูรณ์"
        actions={<Link className="button-secondary" href="/admin">กลับแดชบอร์ดผู้ดูแลระบบ</Link>}
      />
      <ActionFeedback success={params.success} error={params.error} />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel">
          <div className="text-2xl font-semibold">{projects.filter((project) => project.status === "REPORT_APPROVED").length}</div>
          <div className="mt-1 text-sm text-muted">รายงานผ่านแล้ว รอคะแนนที่ปรึกษา</div>
        </div>
        <div className="panel">
          <div className="text-2xl font-semibold">{projects.filter((project) => project.status === "ADVISOR_SCORING").length}</div>
          <div className="mt-1 text-sm text-muted">รอผู้ดูแลระบบยืนยันจบ</div>
        </div>
        <div className="panel">
          <div className="text-2xl font-semibold">{projects.filter((project) => project.status === "COMPLETED").length}</div>
          <div className="mt-1 text-sm text-muted">เสร็จสมบูรณ์</div>
        </div>
      </section>

      <section className="space-y-4">
        {projectCards.length ? (
          projectCards.map(({ project, eligibility }) => <CloseoutCard key={project.id} project={project as CloseoutProject} eligibility={eligibility} />)
        ) : (
          <EmptyState title="ยังไม่มีโครงงานที่อยู่ช่วงยืนยันจบ" description="เมื่อรายงานผ่านและถึงขั้นบันทึกคะแนนสรุปของอาจารย์ที่ปรึกษา รายการจะปรากฏที่นี่" />
        )}
      </section>
    </div>
  );
}
