import { SectionHeading } from "./SectionHeading";

export type TaskListItem = {
  title: string;
  description?: string;
  urgency?: string;
  href?: string;
};

function urgencyTone(urgency?: string) {
  if (!urgency || urgency === "ปกติ") return "badge-lock";
  if (urgency === "สูง" || urgency.toLowerCase() === "high") return "badge-red";
  if (urgency.includes("รอ")) return "badge-warn";
  return "badge-lock";
}

export function TaskListCard({ title, tasks, compact = false }: { title: string; tasks: TaskListItem[]; compact?: boolean }) {
  return (
    <section className={`panel action-list-card ${compact ? "dashboard-console-panel" : ""}`}>
      <SectionHeading title={title} description="Action queue" compact />
      <div className={`${compact ? "mt-3 space-y-2" : "mt-4 space-y-3"}`}>
        {tasks.length ? (
          tasks.map((task) => (
            <div key={task.title} className={`action-list-item ${compact ? "p-2.5" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <div className={`${compact ? "text-sm" : ""} font-semibold text-ink`}>{task.title}</div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${urgencyTone(task.urgency)}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                  {task.urgency ?? "ปกติ"}
                </span>
              </div>
              {task.description ? <p className={`${compact ? "text-xs leading-5" : "text-sm leading-6"} mt-1 text-muted`}>{task.description}</p> : null}
              {task.href ? (
                <a className={`${compact ? "mt-2 sm:min-h-8 sm:rounded-md sm:px-3 sm:py-1.5 sm:text-xs" : "mt-3"} button-secondary w-full sm:w-auto`} href={task.href}>
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
