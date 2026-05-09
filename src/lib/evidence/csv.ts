import { formatSpreadsheetValue, type SpreadsheetValue } from "./spreadsheet";

export type CsvValue = SpreadsheetValue;

export function toCsv(headers: string[], rows: CsvValue[][]) {
  const escape = (value: CsvValue) => {
    const text = String(formatSpreadsheetValue(value));
    if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  return `\uFEFF${[headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n")}\r\n`;
}

export function evidenceFileName(prefix: string, date = new Date(), extension = "csv") {
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${stamp}.${extension}`;
}
