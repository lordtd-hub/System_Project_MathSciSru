import { describe, expect, it } from "vitest";
import { validateStudentImportRows } from "./studentImport";

describe("validateStudentImportRows", () => {
  it("generates emails and detects duplicate student codes", () => {
    const rows = validateStudentImportRows([
      { student_code: "65123456789", first_name_th: "สมชาย", last_name_th: "ใจดี" },
      { student_code: "65123456789", first_name_th: "สมหญิง", last_name_th: "รักเรียน" }
    ]);

    expect(rows[0].generatedEmail).toBe("65123456789@student.sru.ac.th");
    expect(rows[1].errors).toContain("รหัสนักศึกษาซ้ำในไฟล์นำเข้า");
  });
});
