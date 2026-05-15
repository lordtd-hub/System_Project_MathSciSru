import { finalQaRubric } from "@/lib/rubrics/finalQaRubric";
import { ConditionBasedRubricView } from "./ConditionBasedRubricView";

export function FinalQaRubricPanel({ audience = "student" }: { audience?: "student" | "evaluator" }) {
  const description = audience === "student"
    ? "ใช้เกณฑ์นี้เพื่อเตรียมหลักฐานการสอบขั้นสุดท้าย: ผลลัพธ์ต้องโยงกลับไปยังวัตถุประสงค์ แผนงานความก้าวหน้า และรายงานที่ตรวจสอบได้"
    : "ประเมินการสอบนำเสนอขั้นสุดท้ายจากเงื่อนไขที่ตรวจสอบได้ ลดความเห็นส่วนตัว และเชื่อมโยงกับการเสนอหัวข้อ การสอบความก้าวหน้า และรายงานฉบับสมบูรณ์";

  return (
    <ConditionBasedRubricView
      title="เกณฑ์การประเมินการสอบนำเสนอขั้นสุดท้าย"
      description={description}
      sections={finalQaRubric}
    />
  );
}
