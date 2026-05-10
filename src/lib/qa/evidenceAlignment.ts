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
      label: "Proposal objective exists",
      complete: hasText(input.proposalObjectives),
      detail: hasText(input.proposalObjectives)
        ? "Approved proposal objectives are available for final comparison."
        : "No proposal objective text was found for continuity review."
    },
    {
      key: "proposal_timeline",
      label: "Proposal work plan exists",
      complete: timelineTasks.length > 0,
      detail: timelineTasks.length > 0
        ? `${timelineTasks.length} structured 16-week plan task(s) are available.`
        : "No structured proposal work plan was found."
    },
    {
      key: "progress_1_evidence",
      label: "Progress 1 evidence recorded",
      complete: Boolean(input.progress1EvidenceRecorded),
      detail: input.progress1EvidenceRecorded ? "Progress 1 score/evidence exists." : "Progress 1 evidence has not been recorded."
    },
    {
      key: "progress_2_evidence",
      label: "Progress 2 evidence recorded",
      complete: Boolean(input.progress2EvidenceRecorded),
      detail: input.progress2EvidenceRecorded ? "Progress 2 score/evidence exists." : "Progress 2 evidence has not been recorded."
    },
    {
      key: "final_artifact",
      label: "Final artifact exists",
      complete: Boolean(input.finalArtifactRecorded),
      detail: input.finalArtifactRecorded ? "Final presentation artifact/submission exists." : "Final artifact/submission evidence has not been recorded."
    },
    {
      key: "report_evidence",
      label: "Report evidence exists",
      complete: Boolean(input.reportEvidenceRecorded),
      detail: input.reportEvidenceRecorded ? "Report version evidence exists." : "No report version evidence was found."
    }
  ];
}
