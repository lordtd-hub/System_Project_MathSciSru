export type RubricScoreSnapshotItem = {
  rubricItemId: string;
  itemKey: string;
  checked: boolean;
  pointsAwarded: number;
  conditionCount?: number;
  comment?: string | null;
};

export type TeacherScoreSnapshot = {
  totalScore: number;
  overallComment: string | null;
  decision?: string | null;
  reason?: string | null;
  items: RubricScoreSnapshotItem[];
};

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

export function normalizeTeacherScoreSnapshot(snapshot: TeacherScoreSnapshot): TeacherScoreSnapshot {
  return {
    totalScore: Number(snapshot.totalScore),
    overallComment: normalizeText(snapshot.overallComment),
    ...(snapshot.decision !== undefined ? { decision: normalizeText(snapshot.decision) } : {}),
    ...(snapshot.reason !== undefined ? { reason: normalizeText(snapshot.reason) } : {}),
    items: snapshot.items
      .map((item) => ({
        rubricItemId: item.rubricItemId,
        itemKey: item.itemKey,
        checked: Boolean(item.checked),
        pointsAwarded: Number(item.pointsAwarded),
        ...(item.conditionCount === undefined ? {} : { conditionCount: Number(item.conditionCount) }),
        ...(item.comment === undefined ? {} : { comment: normalizeText(item.comment) })
      }))
      .sort((left, right) => left.rubricItemId.localeCompare(right.rubricItemId))
  };
}

export function teacherScoreSnapshotsEqual(left: TeacherScoreSnapshot | null, right: TeacherScoreSnapshot) {
  if (!left) return false;
  return JSON.stringify(normalizeTeacherScoreSnapshot(left)) === JSON.stringify(normalizeTeacherScoreSnapshot(right));
}

export function readTeacherScoreSnapshot(value: unknown): TeacherScoreSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<TeacherScoreSnapshot>;
  if (!Number.isFinite(Number(candidate.totalScore)) || !Array.isArray(candidate.items)) return null;
  const items: RubricScoreSnapshotItem[] = [];
  for (const item of candidate.items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Partial<RubricScoreSnapshotItem>;
    if (
      typeof row.rubricItemId !== "string"
      || typeof row.itemKey !== "string"
      || typeof row.checked !== "boolean"
      || !Number.isFinite(Number(row.pointsAwarded))
      || (row.conditionCount !== undefined && !Number.isInteger(Number(row.conditionCount)))
    ) return null;
    items.push({
      rubricItemId: row.rubricItemId,
      itemKey: row.itemKey,
      checked: row.checked,
      pointsAwarded: Number(row.pointsAwarded),
      ...(row.conditionCount === undefined ? {} : { conditionCount: Number(row.conditionCount) }),
      ...(row.comment === undefined ? {} : { comment: normalizeText(row.comment) })
    });
  }

  return normalizeTeacherScoreSnapshot({
    totalScore: Number(candidate.totalScore),
    overallComment: normalizeText(candidate.overallComment),
    ...(candidate.decision === undefined ? {} : { decision: normalizeText(candidate.decision) }),
    ...(candidate.reason === undefined ? {} : { reason: normalizeText(candidate.reason) }),
    items
  });
}
