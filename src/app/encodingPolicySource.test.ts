import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("UTF-8 encoding policy", () => {
  it("locks source files to UTF-8 and LF at repository level", () => {
    const editorconfig = read(".editorconfig");
    const gitattributes = read(".gitattributes");

    expect(editorconfig).toContain("charset = utf-8");
    expect(editorconfig).toContain("end_of_line = lf");
    expect(editorconfig).toContain("insert_final_newline = true");
    expect(gitattributes).toContain("* text=auto eol=lf");
  });

  it("keeps manual QA demo text as real Thai text", () => {
    const manualDemo = read("src/lib/qa/manualDemo.ts");

    expect(manualDemo).toContain("คู่มือการใช้งานระบบประเมินการนำเสนอโครงงาน");
    expect(manualDemo).toContain("ผู้ดูแลระบบสำหรับจัดทำคู่มือ");
    expect(manualDemo).toContain("นักศึกษาคู่มือ");
  });

  it("keeps CSV exports Thai-safe for Excel", () => {
    const evidenceCsv = read("src/lib/evidence/csv.ts");
    const timelineBuilder = read("src/components/ui/ProposalTimelineBuilder.tsx");

    expect(evidenceCsv).toContain("\\uFEFF");
    expect(timelineBuilder).toContain("\\uFEFF");
    expect(timelineBuilder).toContain('type: "text/csv;charset=utf-8"');
    expect(timelineBuilder).toContain("ลำดับ");
  });
});
