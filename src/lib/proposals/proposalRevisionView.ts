type JsonRecord = Record<string, unknown>;

export type ProposalRevisionView = {
  versionNo: number;
  titleTh: string;
  titleEn: string;
  abstractText: string;
  motivationBackground: string;
  objectives: string;
  proposedMethods: string;
  expectedOutcomes: string;
  timeline: string;
  questionsForTeachers: string;
  materialLink: string;
  declarationAccepted: boolean;
};

type ProposalSubmissionViewSource = {
  titleTh: string;
  titleEn: string | null;
  abstractText: string;
  contentJson: unknown;
  materialLink: string;
  declarationAccepted: boolean;
};

type ProposalSubmissionVersionViewSource = {
  versionNo: number;
  snapshotJson: unknown;
} | null;

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function stringValue(primary: unknown, fallback: unknown): string {
  if (typeof primary === "string") return primary;
  return typeof fallback === "string" ? fallback : "";
}

function booleanValue(primary: unknown, fallback: boolean): boolean {
  return typeof primary === "boolean" ? primary : fallback;
}

export function buildProposalRevisionView(
  submission: ProposalSubmissionViewSource,
  latestVersion: ProposalSubmissionVersionViewSource
): ProposalRevisionView {
  const submissionContent = asRecord(submission.contentJson);
  const snapshot = asRecord(latestVersion?.snapshotJson);
  const snapshotContent = asRecord(snapshot.contentJson);

  return {
    versionNo: latestVersion?.versionNo ?? 1,
    titleTh: stringValue(snapshot.titleTh, submission.titleTh),
    titleEn: stringValue(snapshot.titleEn, submission.titleEn),
    abstractText: stringValue(snapshot.abstractText, submission.abstractText),
    motivationBackground: stringValue(snapshotContent.motivationBackground, submissionContent.motivationBackground),
    objectives: stringValue(snapshotContent.objectives, submissionContent.objectives),
    proposedMethods: stringValue(snapshotContent.proposedMethods, submissionContent.proposedMethods),
    expectedOutcomes: stringValue(snapshotContent.expectedOutcomes, submissionContent.expectedOutcomes),
    timeline: stringValue(snapshotContent.timeline, submissionContent.timeline),
    questionsForTeachers: stringValue(snapshotContent.questionsForTeachers, submissionContent.questionsForTeachers),
    materialLink: stringValue(snapshot.materialLink, submission.materialLink),
    declarationAccepted: booleanValue(snapshot.declarationAccepted, submission.declarationAccepted)
  };
}
