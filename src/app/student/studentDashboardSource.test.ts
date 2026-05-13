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

  it("adds a conservative Figma dashboard renderer while keeping student workflow links", () => {
    const page = source();

    expect(page).toContain("getUiMode");
    expect(page).toContain("figma-student-dashboard");
    expect(page).toContain("FigmaPageHeader");
    expect(page).toContain("FigmaMetricCard");
    expect(page).toContain("FigmaPanel");
    expect(page).toContain("workflowActions.available_now");
    expect(page).toContain("workflowActions.blocked_waiting_for");
    expect(page).toContain("workflowActions.locked_future");
    expect(page).toContain("workflowActions.read_only_history");
    expect(page).toContain("/student/schedule");
    expect(page).toContain("/student/report");
    expect(page).toContain("/student/feedback?round=progress-1#progress-1");
  });
});
