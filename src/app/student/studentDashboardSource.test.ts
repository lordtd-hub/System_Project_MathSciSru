import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(join(process.cwd(), "src/app/student/page.tsx"), "utf8");

describe("student dashboard source", () => {
  it("surfaces current date and a combined assessment status module", () => {
    const page = source();

    expect(page).toContain("วันนี้ {todayText}");
    expect(page).toContain("สถานะกรรมการ วันสอบ และผลประเมิน");
    expect(page).not.toContain("รวมข้อมูลกรรมการ การอนุมัติวันสอบ และผลประเมินที่เปิดเผยแล้วไว้ในโมดูลเดียว");
    expect(page).not.toContain("Assessment & Committee Status");
    expect(page).not.toContain("Assessment results");
    expect(page).not.toContain("กรรมการและการนัดสอบ");
    expect(page).toContain("สถานะการขอวันสอบ");
    expect(page).toContain("ผลการประเมินรอบสอบ");
  });
});
