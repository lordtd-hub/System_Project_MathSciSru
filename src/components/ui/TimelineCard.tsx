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
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3 space-y-3">
        {events.length ? (
          events.map((event) => (
            <div key={event.id} className="border-l-2 border-brand pl-3 text-sm">
              <div className="font-medium">{event.eventTitle}</div>
              <div className="text-xs text-muted">
                {event.occurredAt.toLocaleString("th-TH")}
                {event.actorName ? ` โดย ${event.actorName}` : ""}
              </div>
              {event.eventDescription ? <p className="mt-1 text-muted">{event.eventDescription}</p> : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted">ยังไม่มีประวัติการดำเนินการ</p>
        )}
      </div>
    </section>
  );
}
