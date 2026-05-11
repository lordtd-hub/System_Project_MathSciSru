import { progressQaRubric } from "@/lib/rubrics/progressQaRubric";
import { ConditionBasedRubricView } from "./ConditionBasedRubricView";

export function ProgressQaRubricPanel({
  roundLabel = "ความก้าวหน้า"
}: {
  roundLabel?: string;
}) {
  const titleSuffix = roundLabel === "Progress 1" || roundLabel.includes("ครั้งที่ 1")
    ? "ความก้าวหน้าครั้งที่ 1"
    : roundLabel === "Progress 2" || roundLabel.includes("ครั้งที่ 2")
      ? "ความก้าวหน้าครั้งที่ 2"
      : "ความก้าวหน้า";
  return (
    <ConditionBasedRubricView
      title={`เกณฑ์การประเมิน${titleSuffix}`}
      description="ใช้เกณฑ์นี้เพื่อเตรียมหลักฐานความก้าวหน้า: งานที่รายงานควรโยงกับแผน 16 สัปดาห์ในเอกสารเสนอหัวข้อ มีหลักฐานที่ตรวจสอบได้ และอธิบายความล่าช้าหรือการปรับแผนเมื่อจำเป็น"
      sections={progressQaRubric}
    />
  );
}
