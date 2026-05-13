import Link from "next/link";
import { auth } from "@/auth";
import { FigmaMetricCard, FigmaPageHeader, FigmaPanel, FigmaReviewLayout, FigmaStatusBadge } from "@/components/redesign/VisualSurfaces";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { AdminOperationalSummary, AdminQueueSection } from "@/components/ui/AdminOperationalQueue";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
import { getCompletionEligibility, type CompletionEligibility } from "@/lib/lifecycle/completionEligibility";
import { getUiMode } from "@/lib/uiMode";
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
  const displayStatus =
    completed ? "โครงงานเสร็จสมบูรณ์" : eligibility.hasAdvisorScore ? "พร้อมให้ผู้ดูแลระบบยืนยันจบโครงงาน" : undefined;
  return (
    <article className="panel space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm text-muted">
            {project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}
          </div>
          <h2 className="mt-1 text-lg font-semibold">{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
        </div>
        <StatusBadge status={project.status} label={displayStatus} />
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

function FigmaCloseoutCard({ project, eligibility }: { project: CloseoutProject; eligibility: CompletionEligibility }) {
  const completed = project.status === "COMPLETED";
  const displayStatus = completed
    ? "โครงการเสร็จสมบูรณ์"
    : eligibility.hasAdvisorScore
      ? "พร้อมให้ผู้ดูแลระบบยืนยันจบโครงการ"
      : "รอเงื่อนไขก่อนปิดโครงการ";
  const tone = completed ? "success" : eligibility.eligible ? "action" : "warning";

  return (
    <section id={`closeout-${project.id}`} className="figma-panel scroll-mt-24" data-tone={tone}>
      <FigmaReviewLayout
        context={
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <FigmaStatusBadge tone={tone}>{displayStatus}</FigmaStatusBadge>
              <FigmaStatusBadge tone="muted">{project.status}</FigmaStatusBadge>
            </div>
            <p className="mt-3 text-sm text-muted">
              {project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
            <div className="mt-4 grid gap-2">
              <ChecklistRow label="คะแนนสอบความก้าวหน้าครั้งที่ 1" done={eligibility.hasProgress1Score} />
              <ChecklistRow label="คะแนนสอบความก้าวหน้าครั้งที่ 2" done={eligibility.hasProgress2Score} />
              <ChecklistRow label="คะแนนสอบนำเสนอขั้นสุดท้าย" done={eligibility.hasFinalPresentationScore} />
              <ChecklistRow label="รายงานฉบับสมบูรณ์ผ่านการตรวจ" done={eligibility.hasReachedReportApproved} />
              <ChecklistRow label="คะแนนสรุปของอาจารย์ที่ปรึกษา 25%" done={eligibility.hasAdvisorScore} />
              <ChecklistRow label="ไม่มีคำขอแก้ไขรายงานที่ค้างอยู่" done={!eligibility.hasUnresolvedReportRevision} />
            </div>
          </div>
        }
        action={
          <div className="rounded-lg border border-line bg-paperSoft p-4">
            {completed ? (
              <div className="app-alert alert-success text-sm font-medium">โครงการเสร็จสมบูรณ์แล้ว</div>
            ) : eligibility.eligible ? (
              <form action={completeProjectCloseout} className="space-y-3">
                <input type="hidden" name="project_id" value={project.id} />
                <p className="text-sm text-muted">ครบเงื่อนไขแล้ว ผู้ดูแลระบบต้องยืนยันจบโครงการเพื่อบันทึกหลักฐานปิดงาน</p>
                <SubmitButton confirmMessage="ยืนยันว่าโครงการเสร็จสมบูรณ์หรือไม่? ระบบจะบันทึกประวัติว่าผู้ดูแลระบบตรวจสอบเงื่อนไขครบแล้ว" pendingText="กำลังยืนยัน...">
                  ยืนยันจบโครงการ
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
          </div>
        }
      />
    </section>
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
  const readyToClose = projectCards.filter(({ project, eligibility }) => project.status !== "COMPLETED" && eligibility.eligible);
  const waiting = projectCards.filter(({ project, eligibility }) => project.status !== "COMPLETED" && !eligibility.eligible);
  const completed = projectCards.filter(({ project }) => project.status === "COMPLETED");
  const waitingAdvisorScore = waiting.filter(({ eligibility }) => !eligibility.hasAdvisorScore).length;
  const waitingReport = waiting.filter(({ eligibility }) => !eligibility.hasReachedReportApproved || eligibility.hasUnresolvedReportRevision).length;
  const uiMode = await getUiMode();

  if (uiMode === "figma") {
    return (
      <div className="figma-dashboard-page figma-admin-closeout">
        <FigmaPageHeader
          eyebrow="Admin closeout"
          title="ยืนยันจบโครงการ"
          description="ผู้ดูแลระบบตรวจสอบว่าคะแนนสอบความก้าวหน้า คะแนนสอบขั้นสุดท้าย เล่มรายงาน และคะแนนสรุปของอาจารย์ที่ปรึกษาครบแล้ว ก่อนยืนยันว่าโครงการเสร็จสมบูรณ์"
          actions={<Link className="button-secondary" href="/admin">กลับแดชบอร์ดผู้ดูแลระบบ</Link>}
        />
        <ActionFeedback success={params.success} error={params.error} />

        <div className="figma-kpi-grid">
          <FigmaMetricCard label="ต้องกดยืนยัน" value={readyToClose.length} tone={readyToClose.length ? "action" : "success"} description="ครบเงื่อนไขและยังไม่เป็น COMPLETED" />
          <FigmaMetricCard label="รอคะแนนที่ปรึกษา" value={waitingAdvisorScore} tone={waitingAdvisorScore ? "warning" : "success"} description="รายงานผ่านแล้วหรืออยู่ช่วงก่อนบันทึกคะแนนสรุป" />
          <FigmaMetricCard label="รอรายงาน/แก้ไข" value={waitingReport} tone={waitingReport ? "warning" : "success"} description="ยังไม่ผ่านรายงานฉบับล่าสุด หรือมี revision ค้าง" />
          <FigmaMetricCard label="เสร็จสมบูรณ์" value={completed.length} tone="success" description="Admin closeout เสร็จแล้ว" />
          <FigmaMetricCard label="ทั้งหมดในช่วงปิดงาน" value={projectCards.length} description="รายการที่อยู่ช่วง report/advisor/closeout" />
        </div>

        <section className="figma-dashboard-grid">
          <div className="space-y-4">
            <FigmaPanel
              title="Needs admin action"
              description="ครบเงื่อนไขแล้ว ผู้ดูแลระบบต้องตรวจและยืนยันจบโครงการ"
              tone={readyToClose.length ? "action" : "success"}
            >
              {readyToClose.length ? (
                <div className="figma-action-list">
                  {readyToClose.map(({ project }) => (
                    <a key={project.id} className="figma-action-row" data-tone="action" href={`#closeout-${project.id}`}>
                      <div>
                        <div className="figma-action-title">{project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}</div>
                        <p>{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</p>
                      </div>
                      <div className="figma-action-side"><span>ยืนยันจบ</span></div>
                    </a>
                  ))}
                </div>
              ) : (
                <EmptyState title="ไม่มีรายการที่ต้องกดยืนยันตอนนี้" description="รายการที่ยังไม่ครบจะแสดงในกลุ่ม Waiting" />
              )}
            </FigmaPanel>

            {readyToClose.map(({ project, eligibility }) => (
              <FigmaCloseoutCard key={project.id} project={project as CloseoutProject} eligibility={eligibility} />
            ))}

            <FigmaPanel title="Waiting" description="ยังไม่ควรแสดงเป็นงานให้กดปิด เพราะมีเงื่อนไขรายงานหรือคะแนนที่ยังไม่ครบ" tone={waiting.length ? "warning" : "success"}>
              {waiting.length ? (
                <div className="figma-action-list">
                  {waiting.map(({ project }) => (
                    <a key={project.id} className="figma-action-row" data-tone="warning" href={`#closeout-${project.id}`}>
                      <div>
                        <div className="figma-action-title">{project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}</div>
                        <p>{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</p>
                      </div>
                      <div className="figma-action-side"><span>Waiting</span></div>
                    </a>
                  ))}
                </div>
              ) : (
                <EmptyState title="ไม่มีรายการค้างเงื่อนไขปิดโครงการ" />
              )}
            </FigmaPanel>

            {waiting.map(({ project, eligibility }) => (
              <FigmaCloseoutCard key={project.id} project={project as CloseoutProject} eligibility={eligibility} />
            ))}
          </div>

          <aside className="figma-side-stack">
            <FigmaPanel title="สถานะรวม" description="แยกรายการที่พร้อมปิดออกจากรายการที่รอข้อมูล เพื่อกัน false-ready state" tone="muted">
              <div className="grid gap-2">
                <div className="figma-action-row" data-tone="muted"><div className="figma-action-title">รายงานผ่านแล้ว รอคะแนนที่ปรึกษา</div><div className="figma-action-side"><strong>{projects.filter((project) => project.status === "REPORT_APPROVED").length}</strong></div></div>
                <div className="figma-action-row" data-tone="warning"><div className="figma-action-title">รอผู้ดูแลระบบยืนยันจบ</div><div className="figma-action-side"><strong>{projects.filter((project) => project.status === "ADVISOR_SCORING").length}</strong></div></div>
                <div className="figma-action-row" data-tone="success"><div className="figma-action-title">เสร็จสมบูรณ์</div><div className="figma-action-side"><strong>{projects.filter((project) => project.status === "COMPLETED").length}</strong></div></div>
              </div>
            </FigmaPanel>

            <FigmaPanel title="Completed" description="แยกออกจากงานที่ต้องกด เพื่อไม่ให้รายการเสร็จแล้วบังงานปัจจุบัน" tone="success">
              {completed.length ? (
                <div className="figma-action-list">
                  {completed.map(({ project }) => (
                    <a key={project.id} className="figma-action-row" data-tone="success" href={`#closeout-${project.id}`}>
                      <div>
                        <div className="figma-action-title">{project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}</div>
                        <p>{project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</p>
                      </div>
                      <div className="figma-action-side"><span>COMPLETED</span></div>
                    </a>
                  ))}
                </div>
              ) : (
                <EmptyState title="ยังไม่มีโครงการที่ปิดจบแล้ว" />
              )}
            </FigmaPanel>
          </aside>
        </section>

        {completed.length ? (
          <div className="space-y-4">
            {completed.map(({ project, eligibility }) => (
              <FigmaCloseoutCard key={project.id} project={project as CloseoutProject} eligibility={eligibility} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ยืนยันจบโครงงาน"
        description="ผู้ดูแลระบบตรวจสอบว่าคะแนนสอบความก้าวหน้า คะแนนสอบขั้นสุดท้าย เล่มรายงาน และคะแนนสรุปของอาจารย์ที่ปรึกษาครบแล้ว ก่อนยืนยันว่าโครงงานเสร็จสมบูรณ์"
        actions={<Link className="button-secondary" href="/admin">กลับแดชบอร์ดผู้ดูแลระบบ</Link>}
      />
      <ActionFeedback success={params.success} error={params.error} />

      <AdminOperationalSummary
        title="สรุปการปิดโครงงาน"
        description="รายการที่พร้อมให้ผู้ดูแลระบบกดยืนยันจบจะแยกออกจากรายการที่ยังรอรายงานหรือคะแนนอาจารย์ที่ปรึกษา"
        metrics={[
          { label: "ต้องกดยืนยัน", count: readyToClose.length, tone: readyToClose.length ? "action" : "completed", description: "ครบเงื่อนไขและยังไม่เป็น COMPLETED" },
          { label: "รอคะแนนที่ปรึกษา", count: waitingAdvisorScore, tone: waitingAdvisorScore ? "waiting" : "completed", description: "รายงานผ่านแล้วหรืออยู่ช่วงก่อนบันทึกคะแนนสรุป" },
          { label: "รอรายงาน/แก้ไข", count: waitingReport, tone: waitingReport ? "waiting" : "completed", description: "ยังไม่ผ่านรายงานฉบับล่าสุด หรือมี revision ค้าง" },
          { label: "เสร็จสมบูรณ์", count: completed.length, tone: "completed", description: "Admin closeout เสร็จแล้ว" }
        ]}
      />

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

      {projectCards.length ? (
        <div className="space-y-4">
          <AdminQueueSection
            title="Needs admin action"
            description="ครบเงื่อนไขแล้ว ผู้ดูแลระบบต้องตรวจและยืนยันจบโครงงาน"
            count={readyToClose.length}
            tone={readyToClose.length ? "action" : "completed"}
            emptyState={<EmptyState title="ไม่มีรายการที่ต้องกดยืนยันตอนนี้" description="รายการที่ยังไม่ครบจะแสดงในกลุ่มรอด้านล่าง" />}
          >
            <div className="space-y-3">
              {readyToClose.map(({ project, eligibility }) => <CloseoutCard key={project.id} project={project as CloseoutProject} eligibility={eligibility} />)}
            </div>
          </AdminQueueSection>

          <AdminQueueSection
            title="Waiting"
            description="ยังไม่ควรแสดงเป็นงานให้กดปิด เพราะมีเงื่อนไขรายงานหรือคะแนนที่ยังไม่ครบ"
            count={waiting.length}
            tone={waiting.length ? "waiting" : "completed"}
            emptyState={<EmptyState title="ไม่มีรายการค้างเงื่อนไขปิดโครงงาน" />}
          >
            <div className="space-y-3">
              {waiting.map(({ project, eligibility }) => <CloseoutCard key={project.id} project={project as CloseoutProject} eligibility={eligibility} />)}
            </div>
          </AdminQueueSection>

          <AdminQueueSection
            title="Completed"
            description="แยกออกจากงานที่ต้องกด เพื่อไม่ให้รายการที่เสร็จแล้วบังรายการที่ยังต้องดำเนินการ"
            count={completed.length}
            tone="completed"
            emptyState={<EmptyState title="ยังไม่มีโครงงานที่ปิดจบแล้ว" />}
          >
            <div className="space-y-3">
              {completed.map(({ project, eligibility }) => <CloseoutCard key={project.id} project={project as CloseoutProject} eligibility={eligibility} />)}
            </div>
          </AdminQueueSection>
        </div>
      ) : (
        <section className="panel">
          <EmptyState title="ยังไม่มีโครงงานที่อยู่ช่วงยืนยันจบ" description="เมื่อรายงานผ่านและถึงขั้นบันทึกคะแนนสรุปของอาจารย์ที่ปรึกษา รายการจะปรากฏที่นี่" />
        </section>
      )}
    </div>
  );
}
