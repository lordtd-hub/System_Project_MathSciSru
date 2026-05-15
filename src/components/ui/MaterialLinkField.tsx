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
      <label>
        ลิงก์เอกสารประกอบ
        {required ? <span className="ml-1 text-brand" aria-label="จำเป็นต้องกรอก">*</span> : null}
      </label>
      <input name={name} type="url" required={required} defaultValue={defaultValue ?? ""} placeholder="https://drive.google.com/..." />
      <p className="text-xs text-muted">ใช้ลิงก์จาก Google Drive, Google Docs, Google Slides หรือ Google Classroom เท่านั้น หากมีเอกสารมากกว่า 1 ไฟล์ ให้อัปโหลดรวมไว้ในโฟลเดอร์ Google Drive แล้วส่งลิงก์โฟลเดอร์</p>
    </div>
  );
}
