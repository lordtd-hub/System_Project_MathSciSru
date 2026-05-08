import type { ReactNode } from "react";

type QueueTone = "urgent" | "ready" | "waiting" | "complete" | "quiet";

export type DashboardActionQueueItem = {
  title: string;
  description: string;
  href: string;
  ctaLabel?: string;
  count?: number;
  statusLabel?: string;
  tone?: QueueTone;
  meta?: string;
};

const toneClass: Record<QueueTone, string> = {
  urgent: "border-l-[var(--red-700)] bg-[var(--red-50)]",
  ready: "border-l-[var(--red-700)] bg-surface",
  waiting: "border-l-[var(--warn-700)] bg-[var(--warn-100)]",
  complete: "border-l-[var(--ok-700)] bg-[var(--ok-100)]",
  quiet: "border-l-[var(--ink-300)] bg-[var(--paper-2)]"
};

const badgeClass: Record<QueueTone, string> = {
  urgent: "badge-red",
  ready: "badge-red",
  waiting: "badge-warn",
  complete: "badge-ok",
  quiet: "badge-lock"
};

export function DashboardSectionHeader({
  title,
  description,
  actions
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
      <div>
        <h2 className="text-lg font-semibold leading-6 text-ink">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function DashboardActionQueue({
  title = "งานที่ต้องดำเนินการ",
  description,
  items
}: {
  title?: string;
  description?: string;
  items: DashboardActionQueueItem[];
}) {
  return (
    <section className="panel action-queue-panel">
      <DashboardSectionHeader title={title} description={description ?? "เรียงงานที่ต้องกดต่อหรือพิจารณาก่อนงานติดตามทั่วไป"} />
      <div className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {items.map((item) => {
          const tone = item.tone ?? "quiet";
          return (
            <a
              key={`${item.title}-${item.href}`}
              href={item.href}
              className={`grid gap-3 border-l-4 p-4 transition hover:bg-paperSoft sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${toneClass[tone]}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold leading-6 text-ink">{item.title}</h3>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeClass[tone]}`}>
                    {item.statusLabel ?? (item.count && item.count > 0 ? "ต้องดำเนินการ" : "ติดตาม")}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted">{item.description}</p>
                {item.meta ? <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{item.meta}</p> : null}
              </div>
              <div className="flex items-center gap-3 sm:justify-end">
                {typeof item.count === "number" ? (
                  <span className="min-w-12 text-right text-2xl font-semibold tabular-nums text-ink">{item.count}</span>
                ) : null}
                <span className="button-secondary whitespace-nowrap">{item.ctaLabel ?? "เปิดงานนี้"}</span>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

export function CompactMetricRow({
  title,
  description,
  metrics
}: {
  title: string;
  description?: string;
  metrics: Array<{ label: string; value: number; href: string; tone?: QueueTone }>;
}) {
  return (
    <section className="panel">
      <DashboardSectionHeader title={title} description={description} />
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((metric) => {
          const tone = metric.tone ?? "quiet";
          return (
            <a key={metric.label} href={metric.href} className={`rounded-lg border border-line bg-surface p-3 transition hover:border-brand/40 hover:bg-paperSoft ${tone === "urgent" || tone === "ready" ? "border-l-4 border-l-[var(--red-700)]" : tone === "waiting" ? "border-l-4 border-l-[var(--warn-700)]" : tone === "complete" ? "border-l-4 border-l-[var(--ok-700)]" : "border-l-4 border-l-[var(--ink-300)]"}`}>
              <div className="text-xl font-semibold leading-none text-ink">{metric.value}</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{metric.label}</div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
