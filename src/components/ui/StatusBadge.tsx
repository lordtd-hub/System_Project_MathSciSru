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
    <span className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${tone.badge}`}>
      <span className={`h-2 w-2 rounded-full ${tone.dot}`} aria-hidden="true" />
      สถานะ: {projectStatusLabelTh(status)}
    </span>
  );
}
