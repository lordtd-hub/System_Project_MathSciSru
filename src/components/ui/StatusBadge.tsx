import type { ProjectStatus } from "@prisma/client";
import { projectStatusLabelTh } from "@/lib/lifecycle/statusLabels";

function badgeTone(status: ProjectStatus): { badge: string; dot: string } {
  if (["COMPLETED", "TOPIC_APPROVED", "REPORT_APPROVED"].includes(status)) {
    return { badge: "badge-ok", dot: "bg-current" };
  }
  if (["DRAFT", "STUDENT_PROFILE"].includes(status)) {
    return { badge: "badge-lock", dot: "bg-current" };
  }
  if (["PENDING_ADVISOR", "PENDING_ADMIN", "PROPOSAL_PENDING", "PROPOSAL_ADMIN_DECISION", "PROPOSAL_REVISION_REQUIRED"].includes(status)) {
    return { badge: "badge-warn", dot: "bg-current" };
  }
  if (["PROPOSAL_FAILED", "REPROPOSAL_FAILED"].includes(status)) {
    return { badge: "badge-bad", dot: "bg-current" };
  }
  return { badge: "badge-red", dot: "bg-current" };
}

export function StatusBadge({ status, label }: { status: ProjectStatus; label?: string }) {
  const tone = badgeTone(status);
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none ${tone.badge}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
      สถานะ: {label ?? projectStatusLabelTh(status)}
    </span>
  );
}
