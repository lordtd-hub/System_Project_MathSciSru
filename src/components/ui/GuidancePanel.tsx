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
        <div className="rounded-md border border-line bg-paper p-3">
          <div className="text-sm font-semibold">ขั้นตอนที่ต้องทำ</div>
          <p className="mt-1 text-sm text-muted">{current}</p>
        </div>
        <div className="rounded-md border border-line bg-paper p-3">
          <div className="text-sm font-semibold">สิ่งที่ระบบจะทำต่อ</div>
          <p className="mt-1 text-sm text-muted">{next}</p>
        </div>
        <div className="rounded-md border border-line bg-paper p-3">
          <div className="text-sm font-semibold">ใครเป็นคนทำขั้นถัดไป</div>
          <p className="mt-1 text-sm text-muted">{actor}</p>
        </div>
      </div>
    </section>
  );
}
