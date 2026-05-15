import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("student schedule time inputs", () => {
  it("uses Thai 24-hour select controls instead of browser AM/PM time inputs", () => {
    const source = readFileSync(join(process.cwd(), "src/app/student/schedule/page.tsx"), "utf8");

    expect(source).not.toContain('type="time"');
    expect(source).toContain("scheduleTimeOptions");
    expect(source).toContain("เลือกเวลาเริ่ม");
    expect(source).toContain("ไม่ระบุเวลาสิ้นสุด");
    expect(source).toContain("`${value} น.`");
  });
});
