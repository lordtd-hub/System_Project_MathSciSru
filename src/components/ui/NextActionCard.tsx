import type { NextAction } from "@/lib/lifecycle/nextActions";

export function NextActionCard({ action }: { action: NextAction }) {
  const toneClass =
    action.tone === "warning"
      ? "border-amber-200 bg-amber-50"
      : action.tone === "success"
        ? "border-emerald-200 bg-emerald-50"
        : "border-brand/20 bg-red-50/80";
  const markerClass = action.tone === "warning" ? "bg-amber-500" : action.tone === "success" ? "bg-emerald-600" : "bg-brand";
  const labelClass = action.tone === "warning" ? "text-amber-900" : action.tone === "success" ? "text-emerald-900" : "text-brand";

  return (
    <section className={`relative overflow-hidden rounded-lg border border-l-4 p-5 shadow-sm ${toneClass}`}>
      <div className="absolute right-4 top-4 hidden h-16 w-16 rounded-full border border-white/70 bg-white/35 sm:block" aria-hidden="true" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold tracking-wide text-white ${markerClass}`}>
            NEXT
          </span>
          <div className="relative">
            <div className={`text-xs font-bold uppercase tracking-wide ${labelClass}`}>สิ่งที่ต้องทำต่อไป</div>
            <h2 className="mt-1 text-xl font-semibold text-ink">{action.title}</h2>
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
