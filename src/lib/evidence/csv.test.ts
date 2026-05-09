import { describe, expect, it } from "vitest";
import { evidenceFileName, toCsv } from "./csv";

describe("evidence CSV export", () => {
  it("writes UTF-8 BOM, headers, escaped values, and empty files with headers", () => {
    const csv = toCsv(["หัวข้อ", "note"], [["หัวข้อไทย", 'มี "quote", comma']]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("หัวข้อ,note");
    expect(csv).toContain('"มี ""quote"", comma"');
  });

  it("uses required evidence file naming", () => {
    expect(evidenceFileName("evidence-projects", new Date("2026-05-09T00:00:00.000Z"))).toBe("evidence-projects-20260509.csv");
    expect(evidenceFileName("evidence-projects", new Date("2026-05-09T00:00:00.000Z"), "xlsx")).toBe("evidence-projects-20260509.xlsx");
  });
});
