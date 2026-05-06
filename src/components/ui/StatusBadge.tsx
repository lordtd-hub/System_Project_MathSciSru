import type { ProjectStatus } from "@prisma/client";
import { projectStatusLabelTh } from "@/lib/lifecycle/statusLabels";

function badgeTone(status: ProjectStatus): string {
  if (["COMPLETED", "TOPIC_APPROVED", "REPORT_APPROVED"].includes(status)) return "border-emerald-300 bg-emerald-50 text-emerald-900";
  if (["DRAFT", "STUDENT_PROFILE"].includes(status)) return "border-slate-300 bg-slate-50 text-slate-900";
  if (["PENDING_ADVISOR", "PENDING_ADMIN", "PROPOSAL_PENDING", "PROPOSAL_ADMIN_DECISION"].includes(status)) return "border-amber-300 bg-amber-50 text-amber-900";
  if (["PROPOSAL_FAILED", "REPROPOSAL_FAILED"].includes(status)) return "border-red-300 bg-red-50 text-red-900";
  return "border-sky-300 bg-sky-50 text-sky-900";
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-semibold ${badgeTone(status)}`}>
      สถานะ: {projectStatusLabelTh(status)}
    </span>
  );
}
