import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(join(process.cwd(), "src/app/student/page.tsx"), "utf8");

describe("student dashboard source", () => {
  it("surfaces current date and a compact combined assessment status module", () => {
    const page = source();

    expect(page).toContain("todayText");
    expect(page).toContain("สถานะกรรมการ วันสอบ และผลประเมิน");
    expect(page).not.toContain("รวมข้อมูลกรรมการ การอนุมัติวันสอบ และผลประเมินที่เปิดเผยแล้วไว้ในโมดูลเดียว");
    expect(page).not.toContain("Assessment & Committee Status");
    expect(page).not.toContain("Assessment results");
    expect(page).not.toContain("กรรมการและการนัดสอบ");
    expect(page).toContain("วันสอบล่าสุด:");
    expect(page).toContain("ผลการประเมินรอบสอบ");
    expect(page).toContain("assessmentResultCards");
    expect(page).toContain("/student/feedback?round=progress-1#progress-1");
    expect(page).toContain("/student/feedback?round=progress-2#progress-2");
    expect(page).toContain("/student/feedback?round=final#final");
  });
});
