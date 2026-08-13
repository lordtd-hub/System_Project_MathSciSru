import type { AdvisorRequestStatus, ProjectStatus } from "@prisma/client";

type AdvisorRequestSnapshot = {
  id: string;
  advisorTeacherId: string;
  status: AdvisorRequestStatus;
};

export function isCurrentAdvisorRequestReviewable(input: {
  request: AdvisorRequestSnapshot;
  latestRequestId: string | null;
  actorTeacherId: string;
  projectStatus: ProjectStatus;
}) {
  return input.request.id === input.latestRequestId
    && input.request.advisorTeacherId === input.actorTeacherId
    && input.request.status === "PENDING"
    && input.projectStatus === "PENDING_ADVISOR";
}

export function currentApprovedAdvisorTeacherId(request: AdvisorRequestSnapshot | null | undefined) {
  return request?.status === "APPROVED" ? request.advisorTeacherId : null;
}
