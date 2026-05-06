import type { Decision } from "@prisma/client";

export type ChecklistItemInput = {
  id: string;
  points: number;
  checked: boolean;
  isCritical?: boolean;
  label?: string;
};

export type ChecklistScoreResult = {
  totalScore: number;
  maxScore: number;
  criticalWarnings: string[];
};

export function calculateChecklistScore(items: ChecklistItemInput[]): ChecklistScoreResult {
  return items.reduce<ChecklistScoreResult>(
    (result, item) => {
      result.maxScore += item.points;
      if (item.checked) {
        result.totalScore += item.points;
      } else if (item.isCritical) {
        result.criticalWarnings.push(item.label ?? item.id);
      }
      return result;
    },
    { totalScore: 0, maxScore: 0, criticalWarnings: [] }
  );
}

export function validateProposalDecision(decision: Decision, reason?: string | null): string[] {
  if ((decision === "PASS_WITH_REVISION" || decision === "NOT_PASS") && !reason?.trim()) {
    return ["กรุณาระบุเหตุผลเมื่อเลือกผ่านแบบแก้ไขหรือไม่ผ่าน"];
  }
  return [];
}
