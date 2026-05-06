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

export function LifecycleStepper({ status }: { status: ProjectStatus }) {
  const current = currentStepIndex(status);

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Lifecycle</div>
          <h2 className="text-lg font-semibold text-ink">เส้นทางโครงงาน</h2>
        </div>
        <div className="text-xs text-muted">แสดงขั้นตอนปัจจุบัน ขั้นที่เสร็จแล้ว และขั้นที่ยังล็อกอยู่</div>
      </div>
      <div className="mt-4 overflow-x-auto pb-1">
        <div className="grid min-w-[760px] grid-cols-10 gap-2">
          {steps.map((step, index) => {
            const isDone = index < current;
            const isCurrent = index === current;
            const state = isDone ? "เสร็จแล้ว" : isCurrent ? "ตอนนี้" : "ล็อก";
            const className = isDone
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : isCurrent
                ? "border-brand bg-red-50 text-brandDark shadow-sm"
                : "border-line bg-white text-muted";
            const markerClass = isDone ? "bg-emerald-600 text-white" : isCurrent ? "bg-brand text-white" : "bg-slate-200 text-slate-600";

            return (
              <div key={step.label} className={`rounded-lg border p-3 ${className}`}>
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
