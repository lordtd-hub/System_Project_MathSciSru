import type { ProjectStatus } from "@prisma/client";
import { projectStatusLabelTh } from "@/lib/lifecycle/statusLabels";

function badgeTone(status: ProjectStatus): { badge: string; dot: string } {
  if (["COMPLETED", "TOPIC_APPROVED", "REPORT_APPROVED"].includes(status)) {
    return { badge: "border-emerald-200 bg-emerald-50 text-emerald-900", dot: "bg-emerald-600" };
  }
  if (["DRAFT", "STUDENT_PROFILE"].includes(status)) {
    return { badge: "border-slate-200 bg-slate-50 text-slate-900", dot: "bg-slate-400" };
  }
  if (["PENDING_ADVISOR", "PENDING_ADMIN", "PROPOSAL_PENDING", "PROPOSAL_ADMIN_DECISION"].includes(status)) {
    return { badge: "border-amber-200 bg-amber-50 text-amber-900", dot: "bg-amber-500" };
  }
  if (["PROPOSAL_FAILED", "REPROPOSAL_FAILED"].includes(status)) {
    return { badge: "border-red-200 bg-red-50 text-red-900", dot: "bg-red-600" };
  }
  return { badge: "border-brand/20 bg-red-50 text-brandDark", dot: "bg-brand" };
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const tone = badgeTone(status);
  return (
    <span className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${tone.badge}`}>
      <span className={`h-2 w-2 rounded-full ${tone.dot}`} aria-hidden="true" />
      สถานะ: {projectStatusLabelTh(status)}
    </span>
  );
}
