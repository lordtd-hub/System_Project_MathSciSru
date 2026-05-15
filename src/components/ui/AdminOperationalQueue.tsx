import type { ReactNode } from "react";

type AdminQueueTone = "action" | "waiting" | "ready" | "completed" | "exception" | "locked" | "danger";

const toneClassName: Record<AdminQueueTone, string> = {
  action: "badge-red",
  waiting: "badge-warn",
  ready: "badge-red",
  completed: "badge-ok",
  exception: "badge-warn",
  locked: "badge-lock",
  danger: "badge-red"
};

const panelToneClassName: Record<AdminQueueTone, string> = {
  action: "border-l-[var(--red-700)] bg-surface",
  waiting: "border-l-[var(--warn-700)] bg-[var(--warn-100)]",
  ready: "border-l-[var(--red-700)] bg-surface",
  completed: "border-l-[var(--ok-700)] bg-[var(--ok-100)]",
  exception: "border-l-[var(--warn-700)] bg-[var(--warn-100)]",
  locked: "border-l-[var(--ink-300)] bg-[var(--paper-2)]",
  danger: "border-l-[var(--red-700)] bg-[var(--red-50)]"
};

export type AdminOperationalMetric = {
  label: string;
  count: number;
  tone: AdminQueueTone;
  description?: string;
};

export function AdminQueueBadge({ children, tone = "locked" }: { children: ReactNode; tone?: AdminQueueTone }) {
  return <span className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none ${toneClassName[tone]}`}>{children}</span>;
}

export function AdminOperationalSummary({
  title = "สรุปงานผู้ดูแลระบบ",
  description,
  metrics
}: {
  title?: string;
  description?: string;
  metrics: AdminOperationalMetric[];
}) {
  return (
    <section className="panel dashboard-console-panel">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-2.5">
        <div>
          <h2 className="text-base font-semibold leading-6 text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-xs leading-5 text-muted">{description}</p> : null}
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {metrics.map((metric) => (
          <div key={metric.label} className={`rounded-md border border-line border-l-4 p-2 ${panelToneClassName[metric.tone]}`}>
            <div className="flex items-center justify-between gap-2">
              <AdminQueueBadge tone={metric.tone}>{metric.label}</AdminQueueBadge>
              <span className="text-xl font-semibold tabular-nums">{metric.count}</span>
            </div>
            {metric.description ? <p className="mt-1.5 text-[11px] leading-4 text-muted">{metric.description}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function AdminQueueSection({
  title,
  description,
  count,
  tone,
  children,
  emptyState
}: {
  title: string;
  description?: string;
  count: number;
  tone: AdminQueueTone;
  children: ReactNode;
  emptyState?: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-2">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        <AdminQueueBadge tone={tone}>{count} รายการ</AdminQueueBadge>
      </div>
      <div>{count > 0 ? children : emptyState}</div>
    </section>
  );
}

export function AdminDangerZone({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-red-200 bg-[var(--red-50)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-red-900">{title}</div>
          {description ? <p className="mt-1 text-xs leading-5 text-red-800">{description}</p> : null}
        </div>
        <AdminQueueBadge tone="danger">ต้องตรวจสอบก่อนกด</AdminQueueBadge>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
