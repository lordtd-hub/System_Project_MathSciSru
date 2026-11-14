export type CourseContext = {
  courseCode?: string | null; courseTitle: string; section?: string | null; status: string;
  term: { displayName: string };
};
export function courseStatusText(status: string) {
  return status === "ACTIVE" ? "เปิดอยู่" : status === "CLOSED" ? "ปิดผลแล้ว" : "ยังไม่เปิด";
}
export function CourseContextBadge({ offering, label = "กำลังจัดการรายวิชา" }: { offering: CourseContext; label?: string }) {
  return <aside className="panel mb-4 border-l-4 border-l-primary" aria-label={label}>
    <p className="text-sm font-semibold text-muted">{label}</p>
    <h2 className="mt-1 font-semibold">{offering.courseCode ?? "ยังไม่ระบุรหัสวิชา"} · {offering.courseTitle}</h2>
    <p className="mt-1 text-sm">กลุ่ม {offering.section ?? "ยังไม่ระบุ"} · {offering.term.displayName} · <strong>{courseStatusText(offering.status)}</strong></p>
  </aside>;
}
