import type { ReactNode } from "react";

type StudentSummaryTone = "action" | "waiting" | "done" | "locked" | "info";

type StudentSummaryItem = {
  label: string;
  value: ReactNode;
  detail: string;
  tone?: StudentSummaryTone;
};

const toneClass: Record<StudentSummaryTone, string> = {
  action: "border-brand bg-[var(--red-50)] text-brand",
  waiting: "border-[var(--warn-700)] bg-[var(--warn-100)] text-[var(--warn-700)]",
  done: "border-[var(--ok-700)] bg-[var(--ok-100)] text-[var(--ok-700)]",
  locked: "border-line bg-surface text-muted",
  info: "border-line bg-paper text-ink"
};

export function StudentReadabilitySummary({
  title,
  description,
  items
}: {
  title: string;
  description: string;
  items: StudentSummaryItem[];
}) {
  return (
    <section className="panel" data-testid="student-readability-summary">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className={`rounded-md border p-3 ${toneClass[item.tone ?? "info"]}`}>
            <div className="text-xs font-semibold uppercase tracking-[0.08em]">{item.label}</div>
            <div className="mt-2 text-2xl font-semibold leading-none">{item.value}</div>
            <p className="mt-2 text-sm leading-6 opacity-90">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
