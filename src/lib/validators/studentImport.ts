import { z } from "zod";

export const studentImportRowSchema = z.object({
  student_code: z.string().trim().min(1, "กรุณาระบุรหัสนักศึกษา"),
  first_name_th: z.string().trim().min(1, "กรุณาระบุชื่อ"),
  last_name_th: z.string().trim().min(1, "กรุณาระบุนามสกุล")
});

export type StudentImportInput = z.infer<typeof studentImportRowSchema>;

export type StudentImportPreviewRow = StudentImportInput & {
  rowNumber: number;
  generatedEmail: string;
  errors: string[];
};

const STUDENT_CODE_PATTERN = /^\d{8,15}$/;

export function generatedStudentEmail(studentCode: string): string {
  return `${studentCode.trim()}@student.sru.ac.th`;
}

export function validateStudentImportRows(
  rows: unknown[],
  existingStudentCodes: Set<string> = new Set(),
  existingEmails: Set<string> = new Set()
): StudentImportPreviewRow[] {
  const seenCodes = new Set<string>();

  return rows.map((row, index) => {
    const parsed = studentImportRowSchema.safeParse(row);
    const base = parsed.success
      ? parsed.data
      : {
          student_code: String((row as Record<string, unknown>)?.student_code ?? "").trim(),
          first_name_th: String((row as Record<string, unknown>)?.first_name_th ?? "").trim(),
          last_name_th: String((row as Record<string, unknown>)?.last_name_th ?? "").trim()
        };
    const errors = parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
    const generatedEmail = generatedStudentEmail(base.student_code);

    if (base.student_code && !STUDENT_CODE_PATTERN.test(base.student_code)) {
      errors.push("รหัสนักศึกษาควรเป็นตัวเลข 8-15 หลัก");
    }
    if (seenCodes.has(base.student_code)) {
      errors.push("รหัสนักศึกษาซ้ำในไฟล์นำเข้า");
    }
    if (existingStudentCodes.has(base.student_code)) {
      errors.push("รหัสนักศึกษานี้มีอยู่แล้วในรายวิชาที่เลือก");
    }
    if (existingEmails.has(generatedEmail)) {
      errors.push("อีเมลนักศึกษานี้มีอยู่แล้วในระบบ");
    }

    seenCodes.add(base.student_code);

    return {
      rowNumber: index + 2,
      ...base,
      generatedEmail,
      errors
    };
  });
}

export function hasImportErrors(rows: StudentImportPreviewRow[]): boolean {
  return rows.some((row) => row.errors.length > 0);
}
