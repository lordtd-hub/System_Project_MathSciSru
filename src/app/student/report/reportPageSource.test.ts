import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(join(process.cwd(), "src/app/student/report/page.tsx"), "utf8");

describe("student report page source", () => {
  it("keeps the report page focused on report review rather than final presentation rubric", () => {
    const page = source();

    expect(page).not.toContain("FinalQaRubricPanel");
    expect(page).toContain("ข้อเสนอแนะที่ 1");
    expect(page).toContain("ตำแหน่งที่แก้ไขในเล่ม");
    expect(page).toContain("เหตุผลเชิงวิชาการ");
  });
});
