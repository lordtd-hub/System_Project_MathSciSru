import type { SourceType } from "@prisma/client";

export const selectableSourceTypes: SourceType[] = [
  "STUDENT_INITIATED",
  "ADVISOR_SUGGESTED",
  "COURSEWORK_EXTENSION",
  "RESEARCH_EXTENSION",
  "COMMUNITY_OR_INDUSTRY_PROBLEM",
  "TOPIC_BANK",
  "OTHER"
];

const sourceTypeLabels: Record<SourceType, string> = {
  STUDENT_INITIATED: "นักศึกษาเสนอเอง",
  ADVISOR_SUGGESTED: "อาจารย์เสนอแนะ",
  TOPIC_BANK: "คลังหัวข้อ",
  COURSEWORK_EXTENSION: "ต่อยอดจากรายวิชา",
  RESEARCH_EXTENSION: "ต่อยอดจากงานวิจัย/โครงงานเดิม",
  COMMUNITY_OR_INDUSTRY_PROBLEM: "ปัญหาจากชุมชน/หน่วยงาน/อุตสาหกรรม",
  REVISED_FROM_FAILED_PROPOSAL: "ปรับจาก Proposal ที่ไม่ผ่าน",
  OTHER: "อื่น ๆ"
};

export function sourceTypeLabelTh(sourceType?: SourceType | string | null) {
  if (!sourceType || !(sourceType in sourceTypeLabels)) return "ไม่ระบุ";
  return sourceTypeLabels[sourceType as SourceType];
}

export function parseSelectableSourceType(value: FormDataEntryValue | null): SourceType {
  const sourceType = String(value ?? "STUDENT_INITIATED");
  if (selectableSourceTypes.includes(sourceType as SourceType)) {
    return sourceType as SourceType;
  }
  return "STUDENT_INITIATED";
}
