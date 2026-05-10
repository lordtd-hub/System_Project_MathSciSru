import { progressQaRubric } from "@/lib/rubrics/progressQaRubric";
import { ConditionBasedRubricView } from "./ConditionBasedRubricView";

export function ProgressQaRubricPanel({
  roundLabel = "Progress"
}: {
  roundLabel?: "Progress" | "Progress 1" | "Progress 2";
}) {
  return (
    <ConditionBasedRubricView
      title={`${roundLabel} Evaluation Rubric`}
      description="ใช้ rubric นี้เพื่อเตรียมหลักฐานความก้าวหน้า: งานที่รายงานควรโยงกับแผน 16 สัปดาห์ใน Proposal มีหลักฐานที่ตรวจสอบได้ และอธิบายความล่าช้าหรือการปรับแผนเมื่อจำเป็น"
      sections={progressQaRubric}
    />
  );
}
