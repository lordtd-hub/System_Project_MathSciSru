const encoder = new TextEncoder();

export const requestSizeLimits = {
  studentImportCsvBytes: 2 * 1024 * 1024,
  markdownTextBytes: 20 * 1024,
  commentTextBytes: 10 * 1024,
  shortReasonBytes: 2 * 1024,
  queryParamBytes: 512
} as const;

export function textByteLength(value: string): number {
  return encoder.encode(value).byteLength;
}

export function assertTextSize(value: string, maxBytes: number, label: string): void {
  if (textByteLength(value) > maxBytes) {
    throw new Error(`${label}ยาวเกินกว่าที่ระบบรองรับสำหรับ pilot`);
  }
}

export function sizeError(value: string, maxBytes: number, label: string): string | null {
  return textByteLength(value) > maxBytes ? `${label}ยาวเกินกว่าที่ระบบรองรับสำหรับ pilot` : null;
}
