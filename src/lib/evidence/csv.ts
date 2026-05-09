export type CsvValue = string | number | boolean | Date | null | undefined;

function formatCsvValue(value: CsvValue) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "ใช่" : "ไม่ใช่";
  return String(value);
}

export function toCsv(headers: string[], rows: CsvValue[][]) {
  const escape = (value: CsvValue) => {
    const text = formatCsvValue(value);
    if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  return `\uFEFF${[headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n")}\r\n`;
}

export function evidenceFileName(prefix: string, date = new Date()) {
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${stamp}.csv`;
}
