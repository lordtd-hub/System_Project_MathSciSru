import type { NextAction } from "@/lib/lifecycle/nextActions";

export function NextActionCard({ action }: { action: NextAction }) {
  const toneClass = action.tone === "warning" ? "border-amber-200 bg-amber-50" : action.tone === "success" ? "border-emerald-200 bg-emerald-50" : "border-sky-200 bg-sky-50";
  return (
    <section className={`rounded-lg border p-5 ${toneClass}`}>
      <div className="text-sm font-semibold text-muted">สิ่งที่ต้องทำต่อไป</div>
      <h2 className="mt-1 text-xl font-semibold text-ink">{action.title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{action.description}</p>
      {action.href ? (
        <a className="button mobile-primary-action mt-4" href={action.href}>
          {action.actionLabel ?? "ดำเนินการ"}
        </a>
      ) : null}
    </section>
  );
}
