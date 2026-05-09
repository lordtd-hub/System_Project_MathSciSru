import * as XLSX from "xlsx";
import type { CsvValue } from "./csv";

function formatCellValue(value: CsvValue) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "ใช่" : "ไม่ใช่";
  return value;
}

function safeSheetName(name: string) {
  return name.replace(/[:*?/\\]/g, " ").replace(/\[/g, " ").replace(/\]/g, " ").slice(0, 31) || "Evidence";
}

export function toXlsxBuffer(headers: string[], rows: CsvValue[][], sheetName = "Evidence") {
  const worksheet = XLSX.utils.aoa_to_sheet([
    headers,
    ...rows.map((row) => row.map(formatCellValue))
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(sheetName));
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
