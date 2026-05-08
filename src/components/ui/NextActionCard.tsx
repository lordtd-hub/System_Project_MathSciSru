import type { NextAction } from "@/lib/lifecycle/nextActions";

export function NextActionCard({ action }: { action: NextAction }) {
  const toneClass =
    action.tone === "warning"
      ? "next-action-warning"
      : action.tone === "success"
        ? "next-action-success"
        : "next-action-primary";
  const markerClass = action.tone === "warning" ? "bg-[var(--warn-700)]" : action.tone === "success" ? "bg-[var(--ok-700)]" : "bg-brand";
  const labelClass = action.tone === "warning" ? "text-[var(--warn-700)]" : action.tone === "success" ? "text-[var(--ok-700)]" : "text-brand";

  return (
    <section className={`next-action-card ${toneClass}`}>
      <div className="next-action-rail" aria-hidden="true" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[10px] font-bold uppercase tracking-wide text-white shadow-sm ${markerClass}`}>
            now
          </span>
          <div className="relative">
            <div className={`text-xs font-bold uppercase tracking-[0.16em] ${labelClass}`}>สิ่งที่ต้องทำต่อไป</div>
            <h2 className="mt-1 text-xl font-semibold leading-8 text-ink">{action.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{action.description}</p>
          </div>
        </div>
        {action.href ? (
          <a className="button mobile-primary-action shrink-0" href={action.href}>
            {action.actionLabel ?? "ดำเนินการ"}
          </a>
        ) : null}
      </div>
    </section>
  );
}
