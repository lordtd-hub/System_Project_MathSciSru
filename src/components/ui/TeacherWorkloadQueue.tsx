import type { ReactNode } from "react";

type QueueTone = "action" | "waiting" | "completed" | "returned" | "locked";

const toneClassName: Record<QueueTone, string> = {
  action: "badge-red",
  waiting: "badge-lock",
  completed: "badge-ok",
  returned: "badge-warn",
  locked: "badge-lock"
};

const toneSurfaceClassName: Record<QueueTone, string> = {
  action: "teacher-workload-action",
  waiting: "teacher-workload-waiting",
  completed: "teacher-workload-completed",
  returned: "teacher-workload-returned",
  locked: "teacher-workload-locked"
};

export type TeacherWorkloadMetric = {
  label: string;
  count: number;
  tone: QueueTone;
  description?: string;
};

export function TeacherWorkloadSummary({ metrics }: { metrics: TeacherWorkloadMetric[] }) {
  const total = metrics.reduce((sum, metric) => sum + metric.count, 0);
  const actionCount = metrics.find((metric) => metric.tone === "action")?.count ?? 0;

  return (
    <section className="teacher-workload-summary" aria-labelledby="teacher-workload-summary-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
        <div className="min-w-0">
          <p className="page-kicker">ภาระงานอาจารย์</p>
          <h2 id="teacher-workload-summary-heading" className="mt-0.5 text-base font-semibold">สรุปภาระงานอาจารย์</h2>
        </div>
        <div className="teacher-workload-total" aria-label={`งานที่ต้องดำเนินการ ${actionCount} จากทั้งหมด ${total} รายการ`}>
          <span className="text-xs font-semibold text-muted">ต้องทำตอนนี้</span>
          <strong>{actionCount}</strong>
          <span className="text-xs text-muted">จาก {total}</span>
        </div>
      </div>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric) => (
          <div key={metric.label} className={`teacher-workload-metric ${toneSurfaceClassName[metric.tone]}`} title={metric.description}>
            <div className="flex items-center justify-between gap-1.5">
              <span className={`truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-5 ${toneClassName[metric.tone]}`}>{metric.label}</span>
              <span className="shrink-0 text-lg font-semibold leading-none">{metric.count}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TeacherQueueBadge({ children, tone = "waiting" }: { children: ReactNode; tone?: QueueTone }) {
  return <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-5 ${toneClassName[tone]}`}>{children}</span>;
}

export function TeacherQueueSection({
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
  tone: QueueTone;
  children: ReactNode;
  emptyState?: ReactNode;
}) {
  return (
    <section className={`teacher-queue-section ${toneSurfaceClassName[tone]}`} data-queue-tone={tone}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        <TeacherQueueBadge tone={tone}>{count} รายการ</TeacherQueueBadge>
      </div>
      <div>{count > 0 ? children : emptyState}</div>
    </section>
  );
}

export function TeacherCompactQueueList({
  items
}: {
  items: Array<{
    id: string;
    href?: string;
    title: string;
    description?: string;
    meta?: string;
    badges?: Array<{ label: string; tone?: QueueTone }>;
  }>;
}) {
  if (!items.length) return null;

  return (
    <div className="teacher-compact-queue-list" data-scrollable={items.length > 5 ? "true" : undefined}>
      {items.map((item) => {
        const primaryTone = item.badges?.[0]?.tone ?? "waiting";
        const content = (
          <>
            <div className="min-w-0">
              <div className="truncate font-semibold">{item.title}</div>
              {item.description ? <div className="mt-1 truncate text-sm text-muted">{item.description}</div> : null}
              {item.meta ? <div className="mt-1 text-xs text-muted">{item.meta}</div> : null}
            </div>
            {item.badges?.length ? (
              <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                {item.badges.map((badge) => (
                  <TeacherQueueBadge key={`${item.id}-${badge.label}`} tone={badge.tone ?? "waiting"}>{badge.label}</TeacherQueueBadge>
                ))}
              </div>
            ) : null}
          </>
        );

        return item.href ? (
          <a key={item.id} className={`teacher-compact-queue-item ${toneSurfaceClassName[primaryTone]}`} href={item.href}>
            {content}
          </a>
        ) : (
          <div key={item.id} className={`teacher-compact-queue-item ${toneSurfaceClassName[primaryTone]}`}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
