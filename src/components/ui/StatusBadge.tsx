import type { ProjectStatus } from "@prisma/client";
import { projectStatusLabelTh } from "@/lib/lifecycle/statusLabels";

function badgeTone(status: ProjectStatus): { badge: string; dot: string } {
  if (["COMPLETED", "TOPIC_APPROVED", "REPORT_APPROVED"].includes(status)) {
    return { badge: "badge-ok", dot: "bg-current" };
  }
  if (["DRAFT", "STUDENT_PROFILE"].includes(status)) {
    return { badge: "badge-lock", dot: "bg-current" };
  }
  if (["PENDING_ADVISOR", "PENDING_ADMIN", "PROPOSAL_PENDING", "PROPOSAL_ADMIN_DECISION"].includes(status)) {
    return { badge: "badge-warn", dot: "bg-current" };
  }
  if (["PROPOSAL_FAILED", "REPROPOSAL_FAILED"].includes(status)) {
    return { badge: "badge-bad", dot: "bg-current" };
  }
  return { badge: "badge-red", dot: "bg-current" };
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const tone = badgeTone(status);
  return (
    <span className={`inline-flex min-h-5 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none sm:min-h-8 sm:gap-2 sm:px-3 sm:py-1 sm:text-xs ${tone.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2 ${tone.dot}`} aria-hidden="true" />
      สถานะ: {projectStatusLabelTh(status)}
    </span>
  );
}
