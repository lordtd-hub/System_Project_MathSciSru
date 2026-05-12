import type { AdvisorRequestStatus, CommitteeRole, ProjectStatus, ReportReviewDecision } from "@prisma/client";

export type ReportSubmissionBlockReason =
  | "NOT_FINAL_DONE"
  | "UNDER_REVIEW"
  | "REPORT_APPROVED"
  | "ADVISOR_SCORING"
  | "COMPLETED";

export function getReportSubmissionGate(input: {
  projectStatus: ProjectStatus;
  latestReportHasRevisionRequest: boolean;
  finalPresentationCompleted?: boolean;
}) {
  if (input.projectStatus === "FINAL_DONE" || (input.projectStatus === "IN_PROGRESS" && input.finalPresentationCompleted)) {
    return { allowed: true, reason: null };
  }
  if (input.projectStatus === "REPORT_REVIEW") {
    return input.latestReportHasRevisionRequest
      ? { allowed: true, reason: null }
      : { allowed: false, reason: "UNDER_REVIEW" as const };
  }
  if (input.projectStatus === "REPORT_APPROVED") {
    return { allowed: false, reason: "REPORT_APPROVED" as const };
  }
  if (input.projectStatus === "ADVISOR_SCORING") {
    return { allowed: false, reason: "ADVISOR_SCORING" as const };
  }
  if (input.projectStatus === "COMPLETED") {
    return { allowed: false, reason: "COMPLETED" as const };
  }
  return { allowed: false, reason: "NOT_FINAL_DONE" as const };
}

export function canStudentSubmitFinalReport(input: {
  projectStatus: ProjectStatus;
  latestReportHasRevisionRequest: boolean;
  finalPresentationCompleted?: boolean;
}) {
  return getReportSubmissionGate(input).allowed;
}

export function getStudentReportActionLabel(input: {
  hasReportVersion: boolean;
  latestReportHasRevisionRequest: boolean;
  projectStatus?: ProjectStatus;
}) {
  if (!input.hasReportVersion) return "ส่งเล่มรายงานฉบับสมบูรณ์";
  if (input.latestReportHasRevisionRequest) return "แก้ไขเล่มรายงานตามข้อเสนอแนะของผู้ตรวจ และส่งฉบับใหม่";
  if (input.projectStatus === "REPORT_APPROVED" || input.projectStatus === "ADVISOR_SCORING" || input.projectStatus === "COMPLETED") {
    return "รายงานได้รับการอนุมัติแล้ว";
  }
  return "รอผู้ตรวจพิจารณารายงาน";
}

export function reportSubmissionReasonLabel(reason: ReportSubmissionBlockReason | null) {
  switch (reason) {
    case null:
      return "ส่งเล่มรายงานได้";
    case "UNDER_REVIEW":
      return "อยู่ระหว่างรออาจารย์ตรวจเล่ม";
    case "REPORT_APPROVED":
      return "เล่มรายงานผ่านแล้ว ไม่สามารถส่งซ้ำได้";
    case "ADVISOR_SCORING":
      return "เข้าสู่ขั้นตอน Advisor scoring แล้ว";
    case "COMPLETED":
      return "โครงงานเสร็จสมบูรณ์แล้ว";
    case "NOT_FINAL_DONE":
    default:
      return "ยังไม่ถึงขั้นตอนส่งเล่มรายงาน";
  }
}

export type ReportCommitteeAssignment = {
  teacherId: string;
  role: CommitteeRole;
  active: boolean;
};

export type ReportAdvisorRequest = {
  advisorTeacherId: string;
  status: AdvisorRequestStatus;
};

export function isAssignedReportReviewer(input: {
  teacherId: string;
  committeeAssignments: ReportCommitteeAssignment[];
  advisorRequests: ReportAdvisorRequest[];
}) {
  const committeeReviewer = input.committeeAssignments.some(
    (assignment) =>
      assignment.active &&
      assignment.teacherId === input.teacherId &&
      (assignment.role === "HEAD" || assignment.role === "MEMBER")
  );
  const advisorReviewer = input.advisorRequests.some(
    (request) => request.status === "APPROVED" && request.advisorTeacherId === input.teacherId
  );
  return committeeReviewer || advisorReviewer;
}

export function requiredReportReviewerIds(
  assignments: ReportCommitteeAssignment[],
  advisorRequests: ReportAdvisorRequest[] = []
) {
  return [
    ...new Set(
      [
        ...assignments
        .filter((assignment) => assignment.active && (assignment.role === "HEAD" || assignment.role === "MEMBER"))
        .map((assignment) => assignment.teacherId),
        ...advisorRequests
          .filter((request) => request.status === "APPROVED")
          .map((request) => request.advisorTeacherId)
      ]
    )
  ];
}

export function allRequiredReportReviewersPassed(input: {
  requiredReviewerIds: string[];
  reviews: { reviewerTeacherId: string; decision: ReportReviewDecision }[];
}) {
  if (input.requiredReviewerIds.length === 0) return false;
  const passReviewerIds = new Set(
    input.reviews
      .filter((review) => review.decision === "PASS")
      .map((review) => review.reviewerTeacherId)
  );
  return input.requiredReviewerIds.every((teacherId) => passReviewerIds.has(teacherId));
}

export function latestReportVersionHasRevisionRequest(reviews: { decision: ReportReviewDecision }[]) {
  return reviews.some((review) => review.decision === "FAIL");
}
