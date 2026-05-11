import { auth } from "@/auth";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { prisma } from "@/lib/db";
import Link from "next/link";

type StudentFeedbackPageProps = {
  searchParams?: Promise<{ round?: string }>;
};

function assessmentLabel(roundType?: string | null) {
  if (roundType === "PROGRESS_1") return "Progress 1";
  if (roundType === "PROGRESS_2") return "Progress 2";
  if (roundType === "FINAL_PRESENTATION") return "Final Presentation";
  return "รอบสอบ";
}

function assessmentAnchor(roundType?: string | null) {
  if (roundType === "PROGRESS_1") return "progress-1";
  if (roundType === "PROGRESS_2") return "progress-2";
  if (roundType === "FINAL_PRESENTATION") return "final";
  return undefined;
}

const feedbackTabs = [
  { label: "Proposal", href: "/student/feedback#proposal", round: "proposal" },
  { label: "Progress 1", href: "/student/feedback?round=progress-1#progress-1", round: "progress-1" },
  { label: "Progress 2", href: "/student/feedback?round=progress-2#progress-2", round: "progress-2" },
  { label: "Final Presentation", href: "/student/feedback?round=final#final", round: "final" },
  { label: "ดูทั้งหมด", href: "/student/feedback", round: "all" }
];

function scoreAverage(scores: number[]) {
  if (!scores.length) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function formatScore(score: number | null) {
  if (score === null) return "-";
  return Number.isInteger(score) ? String(score) : score.toFixed(2);
}

export default async function StudentFeedbackPage({ searchParams }: StudentFeedbackPageProps) {
  const session = await auth();
  if (session?.user.role !== "STUDENT" || !session.user.email) {
    return <div className="panel">หน้านี้สำหรับนักศึกษาเท่านั้น</div>;
  }
  const resolvedSearchParams = searchParams ? await Promise.resolve(searchParams) : {};
  const requestedRound = ["progress-1", "progress-2", "final"].includes(resolvedSearchParams.round ?? "") ? resolvedSearchParams.round : undefined;

  const student = await prisma.student.findUnique({
    where: { generatedEmail: session.user.email.toLowerCase() },
    include: {
      projects: {
        include: {
          attempts: {
            include: {
              assessmentRound: true,
              scoreRelease: true,
              proposalResult: true,
              proposalVotes: { include: { teacher: true }, orderBy: { submittedAt: "asc" } },
              evaluatorAssignments: { include: { scoreSubmission: { include: { proposalDecision: true } } } }
            },
            orderBy: { createdAt: "asc" }
          }
        }
      }
    }
  });
  if (!student) {
    return <div className="panel">ยังไม่พบข้อมูลนักศึกษาใน roster ที่นำเข้า</div>;
  }

  const project = student.projects[0];
  const proposalAttempt = project?.attempts.find((item) => item.attemptType === "MAIN_PROPOSAL");
  const allPresentationResults = (project?.attempts ?? [])
    .filter((item) => ["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENTATION"].includes(item.assessmentRound?.roundType ?? item.attemptType))
    .map((item) => {
      const showScore = item.assessmentRound?.showScoreToStudent || item.scoreRelease?.showScore;
      const showFeedback =
        item.assessmentRound?.showFeedbackToStudent ||
        item.scoreRelease?.showFeedback ||
        item.evaluatorAssignments.some((assignment) => assignment.scoreSubmission?.overallComment);
      const submittedScores = item.evaluatorAssignments
        .map((assignment) => assignment.scoreSubmission)
        .filter((score) => score?.status === "SUBMITTED" || score?.status === "LOCKED");
      const scores = submittedScores.map((score) => Number(score?.totalScore ?? 0));
      return {
        attempt: item,
        showScore,
        showFeedback,
        submittedCount: submittedScores.length,
        evaluatorCount: item.evaluatorAssignments.length,
        averageScore: item.officialScore != null ? Number(item.officialScore) : scoreAverage(scores),
        anchor: assessmentAnchor(item.assessmentRound?.roundType)
      };
    });
  const presentationAttempts = allPresentationResults.filter((item) => item.showScore || item.showFeedback || item.submittedCount > 0);
  const displayedPresentationResults = requestedRound
    ? allPresentationResults.filter((item) => item.anchor === requestedRound)
    : presentationAttempts;

  if (!proposalAttempt && !allPresentationResults.length) {
    return <div className="panel">ยังไม่มี feedback หรือผลประเมินที่เปิดเผย</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">ผลและ feedback การประเมิน</h1>
      <nav className="panel flex flex-wrap gap-2 text-sm" aria-label="เลือกดู feedback ตามรอบสอบ">
        {feedbackTabs.map((tab) => (
          <Link
            key={tab.round}
            className={`rounded-md border px-3 py-2 font-medium ${
              (requestedRound ?? "all") === tab.round ? "border-brand bg-brand text-white" : "border-line bg-paper hover:border-brand"
            }`}
            href={tab.href}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {proposalAttempt && !requestedRound ? (
        <>
          <section id="proposal" className="panel scroll-mt-24">
            <h2 className="font-semibold">ผลตัดสิน Proposal</h2>
            <p className="mt-2">{proposalAttempt.proposalResult?.finalDecision ?? "รอ Admin ตัดสินผล"}</p>
            {proposalAttempt.proposalResult?.finalDecisionReason ? (
              <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-sm text-muted" value={proposalAttempt.proposalResult.finalDecisionReason} />
            ) : null}
            <p className="mt-2 text-sm text-muted">Lifecycle v2: นักศึกษาเห็น comment ทันที แต่ไม่เห็นคะแนน Proposal</p>
          </section>
          <section className="panel">
            <h2 className="font-semibold">ข้อเสนอแนะจากกรรมการ Proposal</h2>
            <div className="mt-3 space-y-3">
              {proposalAttempt.proposalVotes.length ? (
                proposalAttempt.proposalVotes.map((vote) => (
                  <div key={vote.id} className="rounded-md border border-line p-3 text-sm">
                    <div className="font-medium">
                      {vote.teacher.academicPrefix}
                      {vote.teacher.firstNameTh} {vote.teacher.lastNameTh}
                    </div>
                    <div className="text-muted">Vote: {vote.vote}</div>
                    {vote.comment ? <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0" value={vote.comment} /> : null}
                  </div>
                ))
              ) : (
                proposalAttempt.evaluatorAssignments
                  .filter((assignment) => assignment.scoreSubmission?.status === "SUBMITTED" || assignment.scoreSubmission?.status === "LOCKED")
                  .map((assignment) => (
                    <div key={assignment.id} className="rounded-md border border-line p-3 text-sm">
                      <div className="font-medium">{assignment.evaluatorDisplayNameSnapshot}</div>
                      <div className="text-muted">ผล: {assignment.scoreSubmission?.proposalDecision?.decision}</div>
                      {assignment.scoreSubmission?.proposalDecision?.reason ? (
                        <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0" value={assignment.scoreSubmission.proposalDecision.reason} />
                      ) : null}
                      {assignment.scoreSubmission?.overallComment ? (
                        <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0" value={assignment.scoreSubmission.overallComment} />
                      ) : null}
                    </div>
                  ))
              )}
            </div>
          </section>
        </>
      ) : null}
      {displayedPresentationResults.length ? (
        <section className="panel">
          <h2 className="font-semibold">{requestedRound ? `ผลการประเมิน ${assessmentLabel(displayedPresentationResults[0]?.attempt.assessmentRound?.roundType)}` : "ผลการประเมิน Progress/Final"}</h2>
          <div className="mt-3 space-y-4">
            {displayedPresentationResults.map((result) => (
              <div key={result.attempt.id} id={result.anchor} className={`scroll-mt-24 rounded-md border p-3 ${requestedRound ? "border-brand bg-paper" : "border-line"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{assessmentLabel(result.attempt.assessmentRound?.roundType)}</h3>
                    <p className="mt-1 text-sm text-muted">กรรมการบันทึกคะแนน {result.submittedCount}/{result.evaluatorCount} คน</p>
                  </div>
                  <div className="rounded-md border border-line bg-paper px-3 py-2 text-sm font-semibold">
                    {result.showScore ? `${formatScore(result.averageScore)} / 100` : "ยังไม่เปิดคะแนน"}
                  </div>
                </div>
                {result.showScore || result.showFeedback || result.submittedCount > 0 ? (
                  <div className="mt-3 space-y-2">
                    {result.attempt.evaluatorAssignments
                    .filter((assignment) => assignment.scoreSubmission?.overallComment || assignment.scoreSubmission?.status === "SUBMITTED" || assignment.scoreSubmission?.status === "LOCKED")
                    .map((assignment) => (
                      <div key={assignment.id} className="rounded-md border border-line bg-paper p-3 text-sm">
                        <div className="font-medium">
                          {result.attempt.assessmentRound?.showEvaluatorNameToStudent || result.attempt.assessmentRound?.status === "SCORING_CLOSED"
                            ? assignment.evaluatorDisplayNameSnapshot
                            : "กรรมการ"}
                        </div>
                        {assignment.scoreSubmission?.overallComment ? (
                          <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0" value={assignment.scoreSubmission.overallComment} />
                        ) : (
                          <p className="mt-1 text-muted">ยังไม่มี comment ที่เปิดเผย</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-md border border-line bg-surface p-3 text-sm text-muted">รอบนี้ยังไม่มีผลหรือ feedback ที่เปิดเผยให้นักศึกษาเห็น</p>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : requestedRound ? (
        <section className="panel">
          <h2 className="font-semibold">ยังไม่มีข้อมูลรอบนี้</h2>
          <p className="mt-2 text-sm text-muted">ระบบยังไม่พบผลหรือ feedback สำหรับรอบที่เลือก</p>
        </section>
      ) : null}
    </div>
  );
}
