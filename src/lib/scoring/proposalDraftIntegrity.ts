export const PROPOSAL_DRAFT_V2_AUDIT_ACTION = "PROPOSAL_DRAFT_V2_SAVED";

export type ProposalDraftScoreItem = {
  rubricItemId: string;
  pointsAwarded: number;
};

export function readOptionalConditionCount(formData: FormData, fieldName: string) {
  const raw = formData.get(fieldName);
  if (raw === null || typeof raw !== "string" || raw.trim() === "") return null;

  if (!/^\d+$/.test(raw.trim())) return null;

  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function proposalDraftConditionCounts(afterJson: unknown) {
  if (!afterJson || typeof afterJson !== "object" || Array.isArray(afterJson)) return {};
  const conditionCounts = (afterJson as { conditionCounts?: unknown }).conditionCounts;
  if (!conditionCounts || typeof conditionCounts !== "object" || Array.isArray(conditionCounts)) return {};

  return Object.fromEntries(
    Object.entries(conditionCounts).filter(
      (entry): entry is [string, number] => Number.isInteger(entry[1]) && Number(entry[1]) >= 0
    )
  );
}

export function shouldRestoreProposalDraftItem({
  submissionStatus,
  hasV2Marker,
  pointsAwarded
}: {
  submissionStatus: "DRAFT" | "SUBMITTED" | "LOCKED" | null | undefined;
  hasV2Marker: boolean;
  pointsAwarded: number;
}) {
  if (submissionStatus !== "DRAFT") return true;
  if (hasV2Marker) return true;
  return pointsAwarded > 0;
}

export function selectedDraftRubricItemIds(items: ProposalDraftScoreItem[], submissionStatus: "DRAFT" | "SUBMITTED" | "LOCKED" | null | undefined, hasV2Marker: boolean) {
  return new Set(
    items
      .filter((item) => shouldRestoreProposalDraftItem({ submissionStatus, hasV2Marker, pointsAwarded: item.pointsAwarded }))
      .map((item) => item.rubricItemId)
  );
}

type ProposalVoteLike = { teacherId: string };
type ProposalAssignmentLike = {
  teacherId: string | null;
  status: string;
  scoreSubmission?: { status: string } | null;
};

export function submittedProposalVotes<TVote extends ProposalVoteLike>(
  votes: TVote[],
  assignments: ProposalAssignmentLike[]
) {
  const submittedTeacherIds = new Set(
    assignments
      .filter((assignment) => assignment.teacherId && (assignment.status === "SUBMITTED" || assignment.scoreSubmission?.status === "SUBMITTED"))
      .map((assignment) => assignment.teacherId as string)
  );
  return votes.filter((vote) => submittedTeacherIds.has(vote.teacherId));
}
