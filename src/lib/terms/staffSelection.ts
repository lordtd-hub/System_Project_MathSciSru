export const COURSE_CONTEXT_ANCHOR_COOKIE = "selected-admin-course-anchor";
type Offering = { id: string; status: string; courseCode?: string | null; section?: string | null; term: { id: string; termType: string; academicYear: { yearBe: number } } };
const rank: Record<string, number> = { SEMESTER_1: 1, SEMESTER_2: 2, SUMMER: 3 };
export function compareAcademicOfferings(a: Offering, b: Offering) {
  return b.term.academicYear.yearBe - a.term.academicYear.yearBe
    || (rank[b.term.termType] ?? 0) - (rank[a.term.termType] ?? 0)
    || (a.courseCode ?? "").localeCompare(b.courseCode ?? "")
    || (a.section ?? "").localeCompare(b.section ?? "", undefined, { numeric: true })
    || b.id.localeCompare(a.id);
}
export function defaultStaffOffering<T extends Offering>(offerings: T[]): T | null {
  const sorted = [...offerings].sort(compareAcademicOfferings);
  return sorted.find(offering => offering.status === "ACTIVE") ?? sorted[0] ?? null;
}
export function chooseStaffOffering<T extends Offering>(offerings: T[], selectedId?: string, selectedCourseAnchor?: string): T | null {
  const current = defaultStaffOffering(offerings);
  // Admin may deliberately manage history; opening a different current course resets stale context.
  return (current?.id === selectedCourseAnchor ? offerings.find(o => o.id === selectedId) : null) ?? current;
}
