import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("manual pages source", () => {
  it("keeps the manual scoped to student and teacher roles", () => {
    const indexPage = read("src/app/manual/page.tsx");
    const studentPage = read("src/app/manual/student/page.tsx");
    const teacherPage = read("src/app/manual/teacher/page.tsx");

    expect(indexPage).toContain("manualGuides.map");
    expect(indexPage).toContain("href={`/manual/${guide.role}`}");
    expect(studentPage).toContain("studentManualGuide");
    expect(teacherPage).toContain("teacherManualGuide");
    expect(indexPage).not.toContain("/manual/admin");
  });

  it("documents schedule resubmission and report revision in user-facing Thai", () => {
    const content = read("src/app/manual/manualContent.ts");

    expect(content).toContain("เสนอวันสอบใหม่");
    expect(content).toContain("วันสอบถูกปฏิเสธ");
    expect(content).toContain("อาจารย์ขอแก้ไขรายงาน");
    expect(content).toContain("ส่งรายงานฉบับใหม่");
    expect(content).toContain("teacher-11-report-request-revision.png");
    expect(content).toContain("student-07-schedule-resubmit.png");
  });

  it("keeps QA login out of end-user manual content", () => {
    const content = read("src/app/manual/manualContent.ts");
    const capturePlan = read("e2e-artifacts/manual-guide/MANUAL_CAPTURE_PLAN.md");

    expect(content).not.toContain("/qa-login");
    expect(capturePlan).toContain("ไม่ถ่ายหน้า `/qa-login` ลงคู่มือผู้ใช้งานจริง");
  });
});
