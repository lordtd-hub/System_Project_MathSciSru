import Link from "next/link";
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
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-2.5">
      <div>
        <h2 className="text-base font-semibold leading-6 text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-xs leading-5 text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function DashboardActionQueue({
  title = "งานที่ต้องดำเนินการ",
  description,
  items,
  mobilePrimaryCount = 3,
  mobileSummaryLabel = "ดูงานติดตามเพิ่มเติม"
}: {
  title?: string;
  description?: string;
  items: DashboardActionQueueItem[];
  mobilePrimaryCount?: number;
  mobileSummaryLabel?: string;
}) {
  const mobilePrimaryItems = items.slice(0, mobilePrimaryCount);
  const mobileSecondaryItems = items.slice(mobilePrimaryCount);

  return (
    <section className="panel dashboard-console-panel action-queue-panel">
      <DashboardSectionHeader title={title} description={description ?? "เรียงงานที่ต้องกดต่อหรือพิจารณาก่อนงานติดตามทั่วไป"} />
      <div className="mt-3 sm:hidden">
        <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {mobilePrimaryItems.map((item) => <DashboardActionQueueRow key={`${item.title}-${item.href}-mobile`} item={item} compact />)}
        </div>
        {mobileSecondaryItems.length ? (
          <details className="mt-2 rounded-lg border border-line bg-surface shadow-sm">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-ink">
              <span>{mobileSummaryLabel}</span>
              <span className="rounded-full border border-line bg-paperSoft px-2 py-0.5 text-xs text-muted">{mobileSecondaryItems.length}</span>
            </summary>
            <div className="divide-y divide-line border-t border-line">
              {mobileSecondaryItems.map((item) => <DashboardActionQueueRow key={`${item.title}-${item.href}-mobile-secondary`} item={item} compact />)}
            </div>
          </details>
        ) : null}
      </div>
      <div className="mt-4 hidden divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface sm:block">
        {items.map((item) => <DashboardActionQueueRow key={`${item.title}-${item.href}`} item={item} />)}
      </div>
    </section>
  );
}

function DashboardActionQueueRow({ item, compact = false }: { item: DashboardActionQueueItem; compact?: boolean }) {
  const tone = item.tone ?? "quiet";
  return (
    <Link
      href={item.href}
      className={`grid border-l-4 transition hover:bg-paperSoft ${compact ? "grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-3" : "gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"} ${toneClass[tone]}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold leading-5 text-ink">{item.title}</h3>
          <span className={`inline-flex min-h-5 items-center rounded-full border px-2 text-[11px] font-semibold leading-none ${badgeClass[tone]}`}>
            {item.statusLabel ?? (item.count && item.count > 0 ? "ต้องดำเนินการ" : "ติดตาม")}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-5 text-muted">{item.description}</p>
        {item.meta ? <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{item.meta}</p> : null}
      </div>
      <div className={`flex items-center gap-2 ${compact ? "justify-end" : "sm:justify-end"}`}>
        {typeof item.count === "number" ? (
          <span className={`${compact ? "min-w-8 text-xl" : "min-w-10 text-xl"} text-right font-semibold tabular-nums text-ink`}>{item.count}</span>
        ) : null}
        <span className="hidden whitespace-nowrap sm:inline-flex sm:min-h-8 sm:items-center sm:justify-center sm:rounded-md sm:border sm:border-lineStrong sm:bg-surface sm:px-3 sm:py-1.5 sm:text-xs sm:font-semibold sm:text-ink sm:shadow-sm">
          {item.ctaLabel ?? "เปิดงานนี้"}
        </span>
        <span className="text-xs font-semibold text-brand sm:hidden">เปิด</span>
      </div>
    </Link>
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
    <section className="panel dashboard-console-panel compact-metric-row-panel">
      <DashboardSectionHeader title={title} description={description} />
      <div className="compact-metric-grid">
        {metrics.map((metric) => {
          const tone = metric.tone ?? "quiet";
          const className = `compact-metric-card ${tone === "urgent" || tone === "ready" ? "border-l-[var(--red-700)]" : tone === "waiting" ? "border-l-[var(--warn-700)]" : tone === "complete" ? "border-l-[var(--ok-700)]" : "border-l-[var(--ink-300)]"}`;
          const content = (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-semibold leading-5 text-muted">{metric.label}</span>
              <span className="shrink-0 text-lg font-semibold leading-none text-ink">{metric.value}</span>
            </div>
          );
          if (metric.href.startsWith("#")) {
            return (
              <a key={metric.label} href={metric.href} className={className} title={metric.label}>
                {content}
              </a>
            );
          }
          return (
            <Link key={metric.label} href={metric.href} className={className} title={metric.label}>
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
