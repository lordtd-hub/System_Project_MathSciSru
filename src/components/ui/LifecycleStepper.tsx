import type { ProjectStatus } from "@prisma/client";
import { lifecyclePhases, lifecycleStepPosition } from "@/lib/lifecycle/statusLabels";

export { lifecycleStepPosition };

export function CompactLifecycleBadge({ status }: { status: ProjectStatus }) {
  const position = lifecycleStepPosition(status);
  const completed = status === "COMPLETED";

  return (
    <span className="inline-flex min-h-8 max-w-full items-center gap-2 rounded-full border border-brand/20 bg-red-50 px-3 py-1 text-xs font-semibold text-brandDark shadow-sm">
      <span className="text-muted">ขั้นที่</span>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] text-white">{position.current}</span>
      <span className="text-muted">/ {position.total}</span>
      {completed ? <span className="text-[11px] text-[var(--ok-700)]">เสร็จสมบูรณ์</span> : null}
    </span>
  );
}

export function LifecycleStepper({ status }: { status: ProjectStatus }) {
  const current = lifecycleStepPosition(status).current - 1;

  return (
    <div className="panel lifecycle-panel overflow-hidden">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">ขั้นตอนโครงงาน</div>
          <h2 className="text-lg font-semibold text-ink">เส้นทางโครงงาน</h2>
        </div>
        <CompactLifecycleBadge status={status} />
      </div>
      <div className="lifecycle-step-scroll">
        <div className="lifecycle-step-track">
          {lifecyclePhases.map((step, index) => {
            const isDone = status === "COMPLETED" ? index <= current : index < current;
            const isCurrent = status === "COMPLETED" ? false : index === current;
            const state = isDone ? "เสร็จแล้ว" : isCurrent ? "ตอนนี้" : "ล็อก";
            const className = isDone
              ? "border-[rgba(31,111,58,0.2)] bg-[var(--ok-100)] text-[var(--ok-700)]"
              : isCurrent
                ? "border-brand bg-red-50 text-brandDark shadow-sm"
                : "border-line bg-surface text-muted";
            const markerClass = isDone ? "bg-[var(--ok-700)] text-white" : isCurrent ? "bg-brand text-white" : "bg-[var(--ink-200)] text-[var(--ink-600)]";

            return (
              <div key={step.label} className={`lifecycle-step-card ${className}`}>
                <div className="flex items-center gap-1.5">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${markerClass}`}>
                    {isDone ? "✓" : index + 1}
                  </span>
                  <span className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-wide">{state}</span>
                </div>
                <div className="mt-1.5 line-clamp-2 text-xs font-semibold leading-5">{step.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
