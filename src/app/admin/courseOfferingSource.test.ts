import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("admin course offering workflow source", () => {
  it("renders academic year and term inputs before student import", () => {
    const page = read("src/app/admin/import-students/page.tsx");
    expect(page).toContain("openCourseOffering");
    expect(page).toContain('name="year_be"');
    expect(page).toContain('name="term_type"');
    expect(page).toContain('value="1"');
    expect(page).toContain('value="2"');
    expect(page).toContain('value="summer"');
    expect(page).toContain('name="course_title"');
    expect(page).toContain("เปิดรายวิชา");
    expect(page).toContain("นำเข้านักศึกษาในรายวิชานี้");
  });

  it("keeps opening a course offering admin-only and duplicate-safe", () => {
    const actions = read("src/app/admin/actions.ts");
    const openStart = actions.indexOf("export async function openCourseOffering");
    const legacyStart = actions.indexOf("export async function createAcademicSetup");
    const openAction = actions.slice(openStart, legacyStart);

    expect(openAction).toContain("requireAdminUserId()");
    expect(openAction).toContain("validateCourseOfferingInput");
    expect(openAction).toContain("prisma.academicYear.upsert");
    expect(openAction).toContain("prisma.term.upsert");
    expect(openAction).toContain("prisma.courseOffering.findFirst");
    expect(openAction).toContain("course_offering_duplicate");
    expect(openAction).toContain("prisma.courseOffering.create");
    expect(openAction).toContain("COURSE_OFFERING_OPENED");
    expect(openAction).toContain("courseOfferingId_roundType");
  });

  it("keeps the legacy setup action routed through the new guarded workflow", () => {
    const actions = read("src/app/admin/actions.ts");
    const legacyStart = actions.indexOf("export async function createAcademicSetup");
    const importStart = actions.indexOf("export async function importStudents");
    const legacyAction = actions.slice(legacyStart, importStart);

    expect(legacyAction).toContain("return openCourseOffering(formData)");
  });

  it("requires student import to target an existing course offering", () => {
    const actions = read("src/app/admin/actions.ts");
    const importStart = actions.indexOf("export async function importStudents");
    const confirmStart = actions.indexOf("export async function confirmProjectAdvisor");
    const importAction = actions.slice(importStart, confirmStart);

    expect(importAction).toContain("requireAdminUserId()");
    expect(importAction).toContain("parseStudentImportCsv(csv)");
    expect(importAction).toContain("prisma.courseOffering.findUnique");
    expect(importAction).toContain("course_offering_missing");
    expect(importAction).toContain("courseOfferingId_studentId");
    expect(importAction).toContain("students_imported");
  });
});
