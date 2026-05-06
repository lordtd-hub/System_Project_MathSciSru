export type TaskListItem = {
  title: string;
  description?: string;
  urgency?: string;
  href?: string;
};

export function TaskListCard({ title, tasks }: { title: string; tasks: TaskListItem[] }) {
  return (
    <section className="panel">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-2">
        {tasks.length ? (
          tasks.map((task) => (
            <div key={task.title} className="rounded-md border border-line p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{task.title}</div>
                <span className="rounded-full border border-line px-2 py-0.5 text-xs">{task.urgency ?? "ปกติ"}</span>
              </div>
              {task.description ? <p className="mt-1 text-sm text-muted">{task.description}</p> : null}
              {task.href ? <a className="button-secondary mt-3 w-full sm:w-auto" href={task.href}>เปิดงานนี้</a> : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted">ยังไม่มีงานที่ต้องดำเนินการ</p>
        )}
      </div>
    </section>
  );
}
