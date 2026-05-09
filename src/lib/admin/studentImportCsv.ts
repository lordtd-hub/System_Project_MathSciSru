import Papa from "papaparse";
import type { StudentImportInput } from "@/lib/validators/studentImport";

type ParseStudentImportCsvResult =
  | { ok: true; rows: StudentImportInput[] }
  | { ok: false; error: string };

const EXPECTED_HEADERS = ["student_code", "first_name_th", "last_name_th"] as const;

export function parseStudentImportCsv(csv: string): ParseStudentImportCsvResult {
  const result = Papa.parse<string[]>(csv, {
    skipEmptyLines: "greedy"
  });

  if (result.errors.length > 0) {
    return { ok: false, error: "student_import_parse_error" };
  }

  const rows = result.data.map((row) => row.map((cell) => cell.trim()));
  if (rows.length <= 1) {
    return { ok: false, error: "student_import_empty" };
  }

  const [header, ...body] = rows;
  const normalizedHeader = header.slice(0, EXPECTED_HEADERS.length).map((cell) => cell.toLowerCase());
  const hasExpectedHeader = EXPECTED_HEADERS.every((expected, index) => normalizedHeader[index] === expected);
  if (!hasExpectedHeader) {
    return { ok: false, error: "student_import_invalid_header" };
  }

  const parsedRows = body.map((row) => ({
    student_code: row[0] ?? "",
    first_name_th: row[1] ?? "",
    last_name_th: row[2] ?? ""
  }));

  if (!parsedRows.length) {
    return { ok: false, error: "student_import_empty" };
  }

  return { ok: true, rows: parsedRows };
}
