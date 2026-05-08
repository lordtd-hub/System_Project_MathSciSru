export function GuidancePanel({
  title,
  current,
  next,
  actor
}: {
  title: string;
  current: string;
  next: string;
  actor: string;
}) {
  return (
    <section className="panel">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="workflow-group workflow-group-current">
          <div className="flex items-center gap-2 text-sm font-semibold text-brandDark">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs text-white">1</span>
            ขั้นตอนที่ต้องทำ
          </div>
          <p className="mt-1 text-sm text-muted">{current}</p>
        </div>
        <div className="workflow-group">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ink-200)] text-xs text-[var(--ink-700)]">2</span>
            สิ่งที่ระบบจะทำต่อ
          </div>
          <p className="mt-1 text-sm text-muted">{next}</p>
        </div>
        <div className="workflow-group workflow-group-waiting">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--warn-700)]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--warn-700)] text-xs text-white">3</span>
            ใครเป็นคนทำขั้นถัดไป
          </div>
          <p className="mt-1 text-sm text-muted">{actor}</p>
        </div>
      </div>
    </section>
  );
}
