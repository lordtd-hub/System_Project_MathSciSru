import { describe, expect, it } from "vitest";
import { parseStudentImportCsv } from "./studentImportCsv";

describe("parseStudentImportCsv", () => {
  it("parses the normal student roster CSV format", () => {
    const parsed = parseStudentImportCsv("student_code,first_name_th,last_name_th\n65123456789,สมชาย,ใจดี");

    expect(parsed).toEqual({
      ok: true,
      rows: [{ student_code: "65123456789", first_name_th: "สมชาย", last_name_th: "ใจดี" }]
    });
  });

  it("keeps quoted comma values in one field", () => {
    const parsed = parseStudentImportCsv('student_code,first_name_th,last_name_th\n65123456789,"สมชาย, ทดสอบ",ใจดี');

    expect(parsed).toEqual({
      ok: true,
      rows: [{ student_code: "65123456789", first_name_th: "สมชาย, ทดสอบ", last_name_th: "ใจดี" }]
    });
  });

  it("preserves Thai text and skips blank lines", () => {
    const parsed = parseStudentImportCsv("student_code,first_name_th,last_name_th\r\n\r\n65123456789,กัญญา,รักเรียน\r\n");

    expect(parsed).toEqual({
      ok: true,
      rows: [{ student_code: "65123456789", first_name_th: "กัญญา", last_name_th: "รักเรียน" }]
    });
  });

  it("returns a parse error for malformed quoted rows", () => {
    const parsed = parseStudentImportCsv('student_code,first_name_th,last_name_th\n65123456789,"สมชาย,ใจดี');

    expect(parsed).toEqual({ ok: false, error: "student_import_parse_error" });
  });
});
