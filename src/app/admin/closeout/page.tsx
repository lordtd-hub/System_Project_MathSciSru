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
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
      <span>{label}</span>
      <span className={done ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>{done ? "ครบแล้ว" : "ยังไม่ครบ"}</span>
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
        <ChecklistRow label="Progress 1 score" done={eligibility.hasProgress1Score} />
        <ChecklistRow label="Progress 2 score" done={eligibility.hasProgress2Score} />
        <ChecklistRow label="Final Presentation score" done={eligibility.hasFinalPresentationScore} />
        <ChecklistRow label="Report approved" done={eligibility.hasReachedReportApproved} />
        <ChecklistRow label="Advisor score 25%" done={eligibility.hasAdvisorScore} />
        <ChecklistRow label="ไม่มี report revision ที่ค้างอยู่" done={!eligibility.hasUnresolvedReportRevision} />
      </div>

      {completed ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">โครงงานเสร็จสมบูรณ์แล้ว</div>
      ) : eligibility.eligible ? (
        <form action={completeProjectCloseout} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <input type="hidden" name="project_id" value={project.id} />
          <SubmitButton confirmMessage="ยืนยันปิดงานโครงงานเป็น COMPLETED หรือไม่? ระบบจะบันทึก timeline ว่า Admin ตรวจสอบเงื่อนไขครบแล้ว" pendingText="กำลังปิดงาน...">
            ปิดงานเป็น COMPLETED
          </SubmitButton>
        </form>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
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
        title="ปิดงานโครงงาน"
        description="ผู้ดูแลระบบตรวจสอบว่า Progress 1, Progress 2, Final Presentation, เล่มรายงาน และ Advisor score ครบแล้ว ก่อนย้ายสถานะเป็น COMPLETED"
        actions={<a className="button-secondary" href="/admin">กลับแดชบอร์ดผู้ดูแลระบบ</a>}
      />
      <ActionFeedback success={params.success} error={params.error} />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel">
          <div className="text-2xl font-semibold">{projects.filter((project) => project.status === "REPORT_APPROVED").length}</div>
          <div className="mt-1 text-sm text-muted">เล่มผ่านแล้ว รอ Advisor score</div>
        </div>
        <div className="panel">
          <div className="text-2xl font-semibold">{projects.filter((project) => project.status === "ADVISOR_SCORING").length}</div>
          <div className="mt-1 text-sm text-muted">รอปิดงานโดยผู้ดูแลระบบ</div>
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
          <EmptyState title="ยังไม่มีโครงงานที่อยู่ช่วงปิดงาน" description="เมื่อเล่มรายงานผ่านและถึงขั้น Advisor score รายการจะปรากฏที่นี่" />
        )}
      </section>
    </div>
  );
}
