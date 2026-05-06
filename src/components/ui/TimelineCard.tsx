export type TimelineCardEvent = {
  id: string;
  occurredAt: Date;
  eventTitle: string;
  eventDescription?: string | null;
  actorName?: string | null;
};

export function TimelineCard({ title = "Evidence timeline", events }: { title?: string; events: TimelineCardEvent[] }) {
  return (
    <section className="panel">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
        <h2 className="font-semibold text-ink">{title}</h2>
      </div>
      <div className="mt-4 space-y-4">
        {events.length ? (
          events.map((event) => (
            <div key={event.id} className="relative border-l border-line pl-4 text-sm">
              <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand ring-4 ring-white" aria-hidden="true" />
              <div className="font-semibold text-ink">{event.eventTitle}</div>
              <div className="mt-0.5 text-xs text-muted">
                {event.occurredAt.toLocaleString("th-TH")}
                {event.actorName ? ` โดย ${event.actorName}` : ""}
              </div>
              {event.eventDescription ? <p className="mt-1 leading-6 text-muted">{event.eventDescription}</p> : null}
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-line bg-paperSoft p-4 text-sm text-muted">ยังไม่มีประวัติการดำเนินการ</p>
        )}
      </div>
    </section>
  );
}
