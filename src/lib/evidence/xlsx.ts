import * as XLSX from "xlsx";
import type { CsvValue } from "./csv";
import { formatSpreadsheetValue } from "./spreadsheet";

function safeSheetName(name: string) {
  return name.replace(/[:*?/\\]/g, " ").replace(/\[/g, " ").replace(/\]/g, " ").slice(0, 31) || "Evidence";
}

export function toXlsxBuffer(headers: string[], rows: CsvValue[][], sheetName = "Evidence") {
  const worksheet = XLSX.utils.aoa_to_sheet([
    headers,
    ...rows.map((row) => row.map(formatSpreadsheetValue))
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(sheetName));
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
