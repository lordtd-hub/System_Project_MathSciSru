import type { ReactNode } from "react";

type QueueTone = "action" | "waiting" | "completed" | "returned" | "locked";

const toneClassName: Record<QueueTone, string> = {
  action: "badge-red",
  waiting: "badge-lock",
  completed: "badge-ok",
  returned: "badge-warn",
  locked: "badge-lock"
};

export type TeacherWorkloadMetric = {
  label: string;
  count: number;
  tone: QueueTone;
  description?: string;
};

export function TeacherWorkloadSummary({ metrics }: { metrics: TeacherWorkloadMetric[] }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-2">
        <div>
          <h2 className="text-lg font-semibold">สรุปภาระงานอาจารย์</h2>
          <p className="mt-1 text-sm text-muted">แยกงานที่ต้องดำเนินการออกจากงานที่รอหรือเสร็จแล้ว เพื่อให้สแกนได้เร็วเมื่อมีหลายโครงงาน</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-md border border-line bg-paper p-3">
            <div className="flex items-center justify-between gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClassName[metric.tone]}`}>{metric.label}</span>
              <span className="text-xl font-semibold">{metric.count}</span>
            </div>
            {metric.description ? <p className="mt-2 text-xs text-muted">{metric.description}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function TeacherQueueBadge({ children, tone = "waiting" }: { children: ReactNode; tone?: QueueTone }) {
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClassName[tone]}`}>{children}</span>;
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
    <section className="panel">
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
    <div className="overflow-hidden rounded-md border border-line">
      {items.map((item) => {
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
          <a key={item.id} className="flex flex-col gap-3 border-b border-line bg-paper p-3 text-sm last:border-b-0 hover:bg-paperSoft sm:flex-row sm:items-center sm:justify-between" href={item.href}>
            {content}
          </a>
        ) : (
          <div key={item.id} className="flex flex-col gap-3 border-b border-line bg-paper p-3 text-sm last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
            {content}
          </div>
        );
      })}
    </div>
  );
}
