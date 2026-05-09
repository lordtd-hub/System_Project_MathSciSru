export type SpreadsheetValue = string | number | boolean | Date | null | undefined;

const formulaPrefixPattern = /^[=+\-@\t\r\n]/;

export function sanitizeSpreadsheetText(value: string) {
  return formulaPrefixPattern.test(value) ? `'${value}` : value;
}

export function formatSpreadsheetValue(value: SpreadsheetValue) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "ใช่" : "ไม่ใช่";
  if (typeof value === "number") return value;
  return sanitizeSpreadsheetText(value);
}
