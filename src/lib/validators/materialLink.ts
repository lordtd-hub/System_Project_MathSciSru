const ALLOWED_HOSTS = new Set([
  "drive.google.com",
  "docs.google.com",
  "classroom.google.com"
]);

export type MaterialLinkValidation =
  | { ok: true; normalizedUrl: string; host: string }
  | { ok: false; reason: string };

export function validateMaterialLink(value: string): MaterialLinkValidation {
  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: false, reason: "กรุณาระบุลิงก์เอกสารประกอบ" };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "รูปแบบลิงก์ไม่ถูกต้อง" };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "ลิงก์ต้องเป็น https เท่านั้น" };
  }

  if (!ALLOWED_HOSTS.has(url.hostname)) {
    return {
      ok: false,
      reason: "อนุญาตเฉพาะลิงก์จาก Google Drive, Google Docs หรือ Google Classroom"
    };
  }

  return { ok: true, normalizedUrl: url.toString(), host: url.hostname };
}

export function isAllowedMaterialLink(value: string): boolean {
  return validateMaterialLink(value).ok;
}
