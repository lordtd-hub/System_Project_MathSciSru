export type FinalScoreInput = {
  researchResults: number;
  executionProblemSolving: number;
  presentation: number;
  overall: number;
};

export const finalCriteria = [
  { key: "researchResults", label: "Research/results", max: 30, order: 1 },
  { key: "executionProblemSolving", label: "Execution/problem-solving", max: 20, order: 2 },
  { key: "presentation", label: "Presentation", max: 20, order: 3 },
  { key: "overall", label: "Overall", max: 10, order: 4 }
] as const;

export const finalRawScoreMax = finalCriteria.reduce((sum, criterion) => sum + criterion.max, 0);

export function validateFinalScore(input: FinalScoreInput) {
  const errors: string[] = [];
  for (const criterion of finalCriteria) {
    const value = input[criterion.key];
    if (!Number.isFinite(value)) errors.push(`${criterion.label} ต้องเป็นตัวเลข`);
    if (!Number.isInteger(value)) errors.push(`${criterion.label} ต้องเป็นจำนวนเต็ม`);
    if (value < 0 || value > criterion.max) errors.push(`${criterion.label} ต้องอยู่ระหว่าง 0-${criterion.max}`);
  }
  return errors;
}

export function totalFinalRawScore(input: FinalScoreInput) {
  return finalCriteria.reduce((sum, criterion) => sum + input[criterion.key], 0);
}

export function totalFinalNormalizedScore(input: FinalScoreInput) {
  return (totalFinalRawScore(input) / finalRawScoreMax) * 100;
}
