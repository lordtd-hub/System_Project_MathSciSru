const RAW_HTML_PATTERN = /<\/?[a-z][\s\S]*>/i;

export function containsRawHtml(value: string): boolean {
  return RAW_HTML_PATTERN.test(value);
}

export function validateMarkdownInput(value: string, label: string): string[] {
  const errors: string[] = [];
  if (!value.trim()) {
    errors.push(`กรุณากรอก${label}`);
  }
  if (containsRawHtml(value)) {
    errors.push(`${label}ไม่อนุญาตให้ใช้ raw HTML`);
  }
  return errors;
}
