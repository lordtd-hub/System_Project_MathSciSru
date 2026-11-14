import type { TermType } from "@prisma/client";

export function compactCourseTerm(term: { termType: TermType; academicYear: { yearBe: number } }) {
  const semester = term.termType === "SEMESTER_1" ? "1" : term.termType === "SEMESTER_2" ? "2" : "ฤดูร้อน";
  return `${semester}/${term.academicYear.yearBe}`;
}
