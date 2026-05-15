import { normalizeProgressPlanTasks } from "./progressPlanCheckConfig";

export type EvidenceContinuityInput = {
  proposalObjectives?: string | null;
  proposalTimelineItems?: unknown;
  progress1EvidenceRecorded?: boolean;
  progress2EvidenceRecorded?: boolean;
  finalArtifactRecorded?: boolean;
  reportEvidenceRecorded?: boolean;
};

export type EvidenceContinuityIndicator = {
  key: string;
  label: string;
  complete: boolean;
  detail: string;
};

function hasText(value?: string | null) {
  return Boolean(value && value.trim().length > 0);
}

export function buildEvidenceContinuityIndicators(input: EvidenceContinuityInput): EvidenceContinuityIndicator[] {
  const timelineTasks = normalizeProgressPlanTasks(input.proposalTimelineItems);
  return [
    {
      key: "proposal_objectives",
      label: "มีวัตถุประสงค์จากเอกสารเสนอหัวข้อ",
      complete: hasText(input.proposalObjectives),
      detail: hasText(input.proposalObjectives)
        ? "พบวัตถุประสงค์ที่ได้รับอนุมัติสำหรับใช้เทียบกับผลงานขั้นสุดท้าย"
        : "ยังไม่พบข้อความวัตถุประสงค์จากเอกสารเสนอหัวข้อ"
    },
    {
      key: "proposal_timeline",
      label: "มีแผนดำเนินงานจากเอกสารเสนอหัวข้อ",
      complete: timelineTasks.length > 0,
      detail: timelineTasks.length > 0
        ? `พบรายการแผนดำเนินงาน 16 สัปดาห์จำนวน ${timelineTasks.length} รายการ`
        : "ยังไม่พบแผนดำเนินงานแบบเป็นรายการจากเอกสารเสนอหัวข้อ"
    },
    {
      key: "progress_1_evidence",
      label: "มีหลักฐานการสอบความก้าวหน้าครั้งที่ 1",
      complete: Boolean(input.progress1EvidenceRecorded),
      detail: input.progress1EvidenceRecorded ? "พบคะแนนหรือหลักฐานของการสอบความก้าวหน้าครั้งที่ 1" : "ยังไม่พบหลักฐานของการสอบความก้าวหน้าครั้งที่ 1"
    },
    {
      key: "progress_2_evidence",
      label: "มีหลักฐานการสอบความก้าวหน้าครั้งที่ 2",
      complete: Boolean(input.progress2EvidenceRecorded),
      detail: input.progress2EvidenceRecorded ? "พบคะแนนหรือหลักฐานของการสอบความก้าวหน้าครั้งที่ 2" : "ยังไม่พบหลักฐานของการสอบความก้าวหน้าครั้งที่ 2"
    },
    {
      key: "final_artifact",
      label: "มีหลักฐานประกอบการสอบขั้นสุดท้าย",
      complete: Boolean(input.finalArtifactRecorded),
      detail: input.finalArtifactRecorded ? "พบหลักฐานหรือเอกสารประกอบการสอบนำเสนอขั้นสุดท้าย" : "ยังไม่พบหลักฐานประกอบการสอบขั้นสุดท้าย"
    },
    {
      key: "report_evidence",
      label: "มีหลักฐานรายงานฉบับสมบูรณ์",
      complete: Boolean(input.reportEvidenceRecorded),
      detail: input.reportEvidenceRecorded ? "พบหลักฐานการส่งรายงาน" : "ยังไม่พบหลักฐานการส่งรายงาน"
    }
  ];
}
