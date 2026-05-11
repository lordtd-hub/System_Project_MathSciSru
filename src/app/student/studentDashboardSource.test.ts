import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(join(process.cwd(), "src/app/student/page.tsx"), "utf8");

describe("student dashboard source", () => {
  it("surfaces current date and a combined assessment status module", () => {
    const page = source();

    expect(page).toContain("วันนี้ {todayText}");
    expect(page).toContain("Assessment & Committee Status");
    expect(page).toContain("สถานะกรรมการ วันสอบ และผลประเมิน");
    expect(page).toContain("สถานะการขอวันสอบ");
    expect(page).toContain("ผลการประเมินรอบสอบ");
  });
});
