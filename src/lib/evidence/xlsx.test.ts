import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { toXlsxBuffer } from "./xlsx";

describe("evidence XLSX export", () => {
  it("writes workbook data with headers and Thai values", () => {
    const buffer = toXlsxBuffer(["หัวข้อ", "status"], [["หัวข้อไทย", true]], "Evidence");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets.Evidence;
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    expect(rows).toEqual([
      ["หัวข้อ", "status"],
      ["หัวข้อไทย", "ใช่"]
    ]);
  });
});
