export type AdvisorScoreInput = {
  responsibility: number;
  researchProcess: number;
  problemSolving: number;
  communication: number;
  professionalism: number;
};

export const advisorCriteria = [
  { key: "responsibility", label: "Responsibility / punctuality", max: 25, order: 1 },
  { key: "researchProcess", label: "Research process and independence", max: 25, order: 2 },
  { key: "problemSolving", label: "Problem-solving and improvement", max: 25, order: 3 },
  { key: "communication", label: "Communication with advisor", max: 15, order: 4 },
  { key: "professionalism", label: "Overall professionalism", max: 10, order: 5 }
] as const;

export function validateAdvisorScore(input: AdvisorScoreInput) {
  const errors: string[] = [];
  for (const criterion of advisorCriteria) {
    const value = input[criterion.key];
    if (!Number.isFinite(value)) errors.push(`${criterion.label} ต้องเป็นตัวเลข`);
    if (!Number.isInteger(value)) errors.push(`${criterion.label} ต้องเป็นจำนวนเต็ม`);
    if (value < 0 || value > criterion.max) errors.push(`${criterion.label} ต้องอยู่ระหว่าง 0-${criterion.max}`);
  }
  return errors;
}

export function totalAdvisorScore(input: AdvisorScoreInput) {
  return advisorCriteria.reduce((sum, criterion) => sum + input[criterion.key], 0);
}
