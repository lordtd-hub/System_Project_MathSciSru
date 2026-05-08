import type { ProjectStatus } from "@prisma/client";

const steps: Array<{ label: string; statuses: ProjectStatus[] }> = [
  { label: "ข้อมูลนักศึกษา", statuses: ["STUDENT_PROFILE"] },
  { label: "ร่างหัวข้อ", statuses: ["DRAFT"] },
  { label: "รอที่ปรึกษา", statuses: ["PENDING_ADVISOR"] },
  { label: "รอผู้ดูแลระบบ", statuses: ["PENDING_ADMIN"] },
  { label: "รอส่ง Proposal", statuses: ["PROPOSAL_PENDING"] },
  { label: "สอบหัวข้อ", statuses: ["PROPOSAL_REVIEW"] },
  { label: "ตัดสินผล Proposal", statuses: ["PROPOSAL_ADMIN_DECISION"] },
  { label: "หัวข้อผ่านแล้ว", statuses: ["TOPIC_APPROVED"] },
  { label: "ดำเนินโครงงาน", statuses: ["IN_PROGRESS", "REPORT_REVIEW", "REPORT_APPROVED", "ADVISOR_SCORING"] },
  { label: "Final/Closeout", statuses: ["FINAL_DONE", "COMPLETED"] }
];

function currentStepIndex(status: ProjectStatus): number {
  const index = steps.findIndex((step) => step.statuses.includes(status));
  return index >= 0 ? index : 0;
}

export function CompactLifecycleBadge({ status }: { status: ProjectStatus }) {
  const current = currentStepIndex(status);
  const step = steps[current];

  return (
    <span className="inline-flex min-h-8 max-w-full items-center gap-2 rounded-full border border-brand/20 bg-red-50 px-3 py-1 text-xs font-semibold text-brandDark shadow-sm">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] text-white">{current + 1}</span>
      <span className="truncate">{step.label}</span>
      <span className="hidden text-muted sm:inline">/ {steps.length}</span>
    </span>
  );
}

export function LifecycleStepper({ status }: { status: ProjectStatus }) {
  const current = currentStepIndex(status);

  return (
    <div className="panel lifecycle-panel overflow-hidden">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Lifecycle</div>
          <h2 className="text-lg font-semibold text-ink">เส้นทางโครงงาน</h2>
        </div>
        <CompactLifecycleBadge status={status} />
      </div>
      <div className="mt-4 overflow-x-auto pb-1">
        <div className="grid min-w-[760px] grid-cols-10 gap-2">
          {steps.map((step, index) => {
            const isDone = index < current;
            const isCurrent = index === current;
            const state = isDone ? "เสร็จแล้ว" : isCurrent ? "ตอนนี้" : "ล็อก";
            const className = isDone
              ? "border-[rgba(31,111,58,0.2)] bg-[var(--ok-100)] text-[var(--ok-700)]"
              : isCurrent
                ? "border-brand bg-red-50 text-brandDark shadow-sm"
                : "border-line bg-surface text-muted";
            const markerClass = isDone ? "bg-[var(--ok-700)] text-white" : isCurrent ? "bg-brand text-white" : "bg-[var(--ink-200)] text-[var(--ink-600)]";

            return (
              <div key={step.label} className={`lifecycle-step-card ${className}`}>
                <div className="flex items-center gap-2">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${markerClass}`}>
                    {isDone ? "✓" : index + 1}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide">{state}</span>
                </div>
                <div className="mt-2 text-sm font-semibold leading-5">{step.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
