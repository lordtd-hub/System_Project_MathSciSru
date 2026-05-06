export type Progress1ScoreInput = {
  progress: number;
  problemSolving: number;
  researchResults: number;
  presentation: number;
  overall: number;
};

export const progress1Criteria = [
  { key: "progress", label: "Progress", max: 30, order: 1 },
  { key: "problemSolving", label: "Problem-solving", max: 20, order: 2 },
  { key: "researchResults", label: "Research/results", max: 20, order: 3 },
  { key: "presentation", label: "Presentation", max: 20, order: 4 },
  { key: "overall", label: "Overall", max: 10, order: 5 }
] as const;

export function validateProgress1Score(input: Progress1ScoreInput) {
  const errors: string[] = [];
  for (const criterion of progress1Criteria) {
    const value = input[criterion.key];
    if (!Number.isFinite(value)) errors.push(`${criterion.label} ต้องเป็นตัวเลข`);
    if (!Number.isInteger(value)) errors.push(`${criterion.label} ต้องเป็นจำนวนเต็ม`);
    if (value < 0 || value > criterion.max) errors.push(`${criterion.label} ต้องอยู่ระหว่าง 0-${criterion.max}`);
  }
  return errors;
}

export function totalProgress1Score(input: Progress1ScoreInput) {
  return progress1Criteria.reduce((sum, criterion) => sum + input[criterion.key], 0);
}

export type Progress2ScoreInput = Progress1ScoreInput;

export const progress2Criteria = progress1Criteria;

export function validateProgress2Score(input: Progress2ScoreInput) {
  return validateProgress1Score(input);
}

export function totalProgress2Score(input: Progress2ScoreInput) {
  return totalProgress1Score(input);
}
