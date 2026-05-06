export function normalizeTeacherEmail(value: FormDataEntryValue | string | null | undefined) {
  const email = String(value ?? "").trim().toLowerCase();
  return email || null;
}

export function assertNoDuplicateTeacherEmail({
  normalizedEmail,
  duplicateTeacherId
}: {
  normalizedEmail: string | null;
  duplicateTeacherId?: string | null;
}) {
  if (normalizedEmail && duplicateTeacherId) {
    throw new Error("อีเมลนี้ถูกใช้กับโปรไฟล์อาจารย์คนอื่นแล้ว");
  }
}

