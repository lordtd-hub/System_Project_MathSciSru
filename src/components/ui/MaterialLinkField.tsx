export function MaterialLinkField({
  name = "material_link",
  defaultValue,
  required = true
}: {
  name?: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label>ลิงก์เอกสารประกอบ</label>
      <input name={name} type="url" required={required} defaultValue={defaultValue ?? ""} placeholder="https://drive.google.com/..." />
      <p className="text-xs text-muted">ใช้ลิงก์จาก Google Drive, Google Docs, Google Slides หรือ Google Classroom เท่านั้น</p>
    </div>
  );
}
