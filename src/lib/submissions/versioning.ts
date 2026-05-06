export function nextVersionNo(existingCount: number): number {
  return existingCount + 1;
}

export function canEditUntilDeadline(now: Date, deadline?: Date | null): boolean {
  return !deadline || now <= deadline;
}

export function buildSubmissionSnapshot<T extends Record<string, unknown>>(data: T) {
  return {
    ...data,
    snapshotCreatedAt: new Date().toISOString()
  };
}
