import { buildEvidenceContinuityIndicators } from "@/lib/qa/evidenceAlignment";
import { normalizeProgressPlanTasks } from "@/lib/qa/progressPlanCheckConfig";

type ProgressHistoryItem = {
  label: string;
  score?: number | string | null;
  submittedAt?: Date | null;
};

type FinalArtifactItem = {
  label: string;
  value?: string | null;
};

export function FinalEvidenceContinuityPanel({
  proposalObjectives,
  proposalTimelineItems,
  progressHistory,
  finalArtifacts,
  reportEvidenceRecorded
}: {
  proposalObjectives?: string | null;
  proposalTimelineItems?: unknown;
  progressHistory: ProgressHistoryItem[];
  finalArtifacts: FinalArtifactItem[];
  reportEvidenceRecorded: boolean;
}) {
  const tasks = normalizeProgressPlanTasks(proposalTimelineItems);
  const indicators = buildEvidenceContinuityIndicators({
    proposalObjectives,
    proposalTimelineItems,
    progress1EvidenceRecorded: progressHistory.some((item) => item.label === "Progress 1" && item.score !== null && item.score !== undefined),
    progress2EvidenceRecorded: progressHistory.some((item) => item.label === "Progress 2" && item.score !== null && item.score !== undefined),
    finalArtifactRecorded: finalArtifacts.some((item) => Boolean(item.value)),
    reportEvidenceRecorded
  });

  return (
    <section className="panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">QA evidence continuity check</h2>
          <p className="mt-1 text-sm text-muted">
            ใช้ตรวจว่า Final เชื่อมโยงกับวัตถุประสงค์ Proposal แผน 16 สัปดาห์ ผล Progress และหลักฐานรายงานหรือไม่
          </p>
        </div>
        <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold">
          {indicators.filter((item) => item.complete).length}/{indicators.length} evidence signals
        </span>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-md border border-line bg-surface p-3">
          <h3 className="text-sm font-semibold">Approved objectives</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{proposalObjectives?.trim() || "ยังไม่พบวัตถุประสงค์จาก Proposal"}</p>
        </div>
        <div className="rounded-md border border-line bg-surface p-3">
          <h3 className="text-sm font-semibold">Evidence continuity indicators</h3>
          <div className="mt-2 space-y-2 text-sm">
            {indicators.map((indicator) => (
              <div key={indicator.key} className="flex items-start justify-between gap-3 rounded-md border border-line bg-paper p-2">
                <div>
                  <div className="font-medium">{indicator.label}</div>
                  <div className="text-muted">{indicator.detail}</div>
                </div>
                <span className="rounded-full border border-line px-2 py-1 text-xs">{indicator.complete ? "พบหลักฐาน" : "ยังไม่พบ"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="rounded-md border border-line bg-surface p-3">
          <h3 className="text-sm font-semibold">Proposal work plan</h3>
          <div className="mt-2 space-y-2 text-sm">
            {tasks.length ? tasks.map((task, index) => (
              <div key={`${index}-${task.startWeek}-${task.endWeek}`} className="rounded-md bg-paper p-2">
                <div className="font-medium">{task.activity || "ยังไม่ระบุกิจกรรม"}</div>
                <div className="text-muted">สัปดาห์ {task.startWeek}-{task.endWeek} · {task.deliverable || "ยังไม่ระบุหลักฐาน"}</div>
              </div>
            )) : <p className="text-muted">ยังไม่มี structured work plan</p>}
          </div>
        </div>
        <div className="rounded-md border border-line bg-surface p-3">
          <h3 className="text-sm font-semibold">Progress history</h3>
          <div className="mt-2 space-y-2 text-sm">
            {progressHistory.length ? progressHistory.map((item) => (
              <div key={item.label} className="rounded-md bg-paper p-2">
                <div className="font-medium">{item.label}</div>
                <div className="text-muted">
                  {item.score !== null && item.score !== undefined ? `score/evidence: ${item.score}` : "ยังไม่พบคะแนน/หลักฐาน"}
                  {item.submittedAt ? ` · ${item.submittedAt.toLocaleDateString("th-TH")}` : ""}
                </div>
              </div>
            )) : <p className="text-muted">ยังไม่พบหลักฐาน Progress</p>}
          </div>
        </div>
        <div className="rounded-md border border-line bg-surface p-3">
          <h3 className="text-sm font-semibold">Final artifacts</h3>
          <div className="mt-2 space-y-2 text-sm">
            {finalArtifacts.map((artifact) => (
              <div key={artifact.label} className="rounded-md bg-paper p-2">
                <div className="font-medium">{artifact.label}</div>
                <div className="break-words text-muted">{artifact.value || "ยังไม่พบหลักฐาน"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
