import { SectionHeading } from "./SectionHeading";

export type TaskListItem = {
  title: string;
  description?: string;
  urgency?: string;
  href?: string;
};

function urgencyTone(urgency?: string) {
  if (!urgency || urgency === "ปกติ") return "border-slate-200 bg-slate-50 text-slate-700";
  if (urgency === "สูง" || urgency.toLowerCase() === "high") return "border-brand/20 bg-red-50 text-brandDark";
  if (urgency.includes("รอ")) return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function TaskListCard({ title, tasks }: { title: string; tasks: TaskListItem[] }) {
  return (
    <section className="panel action-list-card">
      <SectionHeading title={title} description="Action queue" compact />
      <div className="mt-4 space-y-3">
        {tasks.length ? (
          tasks.map((task) => (
            <div key={task.title} className="action-list-item">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-ink">{task.title}</div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${urgencyTone(task.urgency)}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                  {task.urgency ?? "ปกติ"}
                </span>
              </div>
              {task.description ? <p className="mt-1 text-sm leading-6 text-muted">{task.description}</p> : null}
              {task.href ? (
                <a className="button-secondary mt-3 w-full sm:w-auto" href={task.href}>
                  เปิดงานนี้
                </a>
              ) : null}
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-line bg-paperSoft p-4 text-sm text-muted">ยังไม่มีงานที่ต้องดำเนินการ</p>
        )}
      </div>
    </section>
  );
}
