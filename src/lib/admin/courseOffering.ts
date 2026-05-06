import type { TermType } from "@prisma/client";
import { termDisplayName } from "@/lib/terms/display";

export const defaultCourseTitle = "Mathematical Project Course";

const termInputMap: Record<string, TermType> = {
  "1": "SEMESTER_1",
  SEMESTER_1: "SEMESTER_1",
  "2": "SEMESTER_2",
  SEMESTER_2: "SEMESTER_2",
  summer: "SUMMER",
  SUMMER: "SUMMER"
};

export type CourseOfferingInputResult =
  | { ok: true; data: { yearBe: number; termType: TermType; courseTitle: string; termDisplayName: string } }
  | { ok: false; error: "invalid_year" | "invalid_term" | "invalid_course_title" };

export function normalizeTermType(value: FormDataEntryValue | string | null | undefined): TermType | null {
  const key = String(value ?? "").trim();
  return termInputMap[key] ?? null;
}

export function normalizeCourseTitle(value: FormDataEntryValue | string | null | undefined): string {
  const title = String(value ?? "").trim();
  return title.length ? title : defaultCourseTitle;
}

export function validateCourseOfferingInput(input: {
  yearBe: FormDataEntryValue | string | null | undefined;
  termType: FormDataEntryValue | string | null | undefined;
  courseTitle?: FormDataEntryValue | string | null | undefined;
}): CourseOfferingInputResult {
  const yearBe = Number(String(input.yearBe ?? "").trim());
  if (!Number.isInteger(yearBe) || yearBe < 2500 || yearBe > 2700) return { ok: false, error: "invalid_year" };

  const termType = normalizeTermType(input.termType);
  if (!termType) return { ok: false, error: "invalid_term" };

  const courseTitle = normalizeCourseTitle(input.courseTitle);
  if (courseTitle.length > 120) return { ok: false, error: "invalid_course_title" };

  return { ok: true, data: { yearBe, termType, courseTitle, termDisplayName: termDisplayName(termType, yearBe) } };
}

export function courseOfferingLabel(offering: {
  courseTitle: string;
  term: { displayName: string };
}): string {
  return `${offering.term.displayName} - ${offering.courseTitle}`;
}
