import { finalQaRubric } from "@/lib/rubrics/finalQaRubric";
import { ConditionBasedRubricView } from "./ConditionBasedRubricView";

export function FinalQaRubricPanel({ audience = "student" }: { audience?: "student" | "evaluator" }) {
  const description = audience === "student"
    ? "ใช้ rubric นี้เพื่อเตรียมหลักฐาน Final: ผลลัพธ์ต้องโยงกลับไปยังวัตถุประสงค์ แผนงาน Progress และรายงานที่ตรวจสอบได้"
    : "QA preview: ประเมิน Final จากเงื่อนไขที่ตรวจสอบได้ ลดความเห็นส่วนตัว และเชื่อมโยง Proposal / Progress / Report";

  return (
    <ConditionBasedRubricView
      title="Final Evaluation Rubric"
      description={description}
      sections={finalQaRubric}
    />
  );
}
