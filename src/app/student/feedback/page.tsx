import { auth } from "@/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { PageHeader } from "@/components/ui/PageHeader";
import { StudentReadabilitySummary } from "@/components/ui/StudentReadabilitySummary";
import {
  FigmaMetricCard,
  FigmaPageHeader,
  FigmaStatusBadge
} from "@/components/redesign/VisualSurfaces";
import { prisma } from "@/lib/db";
import { getUiMode } from "@/lib/uiMode";
import Link from "next/link";

type StudentFeedbackPageProps = {
  searchParams?: Promise<{ round?: string }>;
};

function assessmentLabel(roundType?: string | null) {
  if (roundType === "PROGRESS_1") return "การสอบความก้าวหน้าครั้งที่ 1";
  if (roundType === "PROGRESS_2") return "การสอบความก้าวหน้าครั้งที่ 2";
  if (roundType === "FINAL_PRESENTATION") return "การสอบนำเสนอขั้นสุดท้าย";
  return "รอบสอบ";
}

function assessmentAnchor(roundType?: string | null) {
  if (roundType === "PROGRESS_1") return "progress-1";
  if (roundType === "PROGRESS_2") return "progress-2";
  if (roundType === "FINAL_PRESENTATION") return "final";
  return undefined;
}

const feedbackTabs = [
  { label: "ความก้าวหน้าครั้งที่ 1", href: "/student/feedback?round=progress-1#progress-1", round: "progress-1" },
  { label: "ความก้าวหน้าครั้งที่ 2", href: "/student/feedback?round=progress-2#progress-2", round: "progress-2" },
  { label: "สอบขั้นสุดท้าย", href: "/student/feedback?round=final#final", round: "final" },
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
              evaluatorAssignments: {
                include: {
                  scoreSubmission: {
                    include: {
                      scoreItems: {
                        include: { rubricItem: true },
                        orderBy: { rubricItem: { displayOrder: "asc" } }
                      }
                    }
                  }
                }
              }
            },
            orderBy: { createdAt: "asc" }
          }
        }
      }
    }
  });
  if (!student) {
    return <div className="panel">ยังไม่พบข้อมูลนักศึกษาในรายชื่อที่นำเข้า</div>;
  }

  const project = student.projects[0];
  const allPresentationResults = (project?.attempts ?? [])
    .filter((item) => ["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENTATION"].includes(item.assessmentRound?.roundType ?? item.attemptType))
    .map((item) => {
      const submittedScores = item.evaluatorAssignments
        .map((assignment) => assignment.scoreSubmission)
        .filter((score) => score?.status === "SUBMITTED" || score?.status === "LOCKED");
      const hasSubmittedScore = submittedScores.length > 0;
      const hasSubmittedFeedback = submittedScores.some((score) => Boolean(score?.overallComment?.trim()));
      const showScore = hasSubmittedScore;
      const showFeedback = hasSubmittedFeedback || hasSubmittedScore;
      const scores = submittedScores.map((score) => Number(score?.totalScore ?? 0));
      return {
        attempt: item,
        showScore,
        showFeedback: showFeedback || hasSubmittedFeedback,
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
  const waitingResultCount = Math.max(allPresentationResults.length - presentationAttempts.length, 0);
  const uiMode = await getUiMode();
  const feedbackTone = presentationAttempts.length ? "success" : waitingResultCount ? "waiting" : "muted";

  if (!allPresentationResults.length) {
    return (
      <div className={uiMode === "figma" ? "figma-dashboard-page figma-student-feedback" : "space-y-6"} data-testid="student-feedback-page-content">
        {uiMode === "figma" ? (
          <FigmaPageHeader
            eyebrow="Student Feedback"
            title="ผลและข้อเสนอแนะการประเมิน"
            description="หน้านี้เป็นข้อมูลอ่านอย่างเดียวสำหรับติดตามคะแนนและข้อเสนอแนะที่บันทึกแล้ว"
            actions={<FigmaStatusBadge tone="muted">ยังไม่มีผลที่เปิดเผย</FigmaStatusBadge>}
          />
        ) : (
          <PageHeader
            title="ผลและข้อเสนอแนะการประเมิน"
            description="หน้านี้เป็นข้อมูลอ่านอย่างเดียวสำหรับติดตามคะแนนและข้อเสนอแนะที่บันทึกแล้ว"
          />
        )}
        <EmptyState title="ยังไม่มีข้อเสนอแนะหรือผลประเมินที่เปิดเผย" description="เมื่อกรรมการบันทึกคะแนนหรือข้อเสนอแนะแล้ว รายการจะแสดงในหน้านี้" />
      </div>
    );
  }

  return (
    <div className={uiMode === "figma" ? "figma-dashboard-page figma-student-feedback" : "space-y-6"} data-testid="student-feedback-page-content">
      {uiMode === "figma" ? (
        <FigmaPageHeader
          eyebrow="Student Feedback"
          title="ผลและข้อเสนอแนะการประเมิน"
          description="หน้านี้เป็นข้อมูลอ่านอย่างเดียว ไม่ใช่งานที่นักศึกษาต้องส่งเพิ่ม"
          actions={
            <FigmaStatusBadge tone={feedbackTone}>
              {presentationAttempts.length ? "มีผลที่อ่านได้" : waitingResultCount ? "รอคะแนน" : "ยังไม่มีผล"}
            </FigmaStatusBadge>
          }
        />
      ) : (
        <PageHeader
          title="ผลและข้อเสนอแนะการประเมิน"
          description="หน้านี้เป็นข้อมูลอ่านอย่างเดียว ไม่ใช่งานที่นักศึกษาต้องส่งเพิ่ม"
        />
      )}
      {uiMode === "figma" ? (
        <div className="figma-kpi-grid">
          <FigmaMetricCard
            label="อ่านได้แล้ว"
            value={presentationAttempts.length}
            tone={presentationAttempts.length ? "success" : "muted"}
            description="รอบที่มีคะแนนหรือข้อเสนอแนะบันทึกแล้ว"
          />
          <FigmaMetricCard
            label="รอคะแนน"
            value={waitingResultCount}
            tone={waitingResultCount ? "waiting" : "muted"}
            description="รอบที่ยังไม่มีข้อมูลให้แสดง"
          />
          <FigmaMetricCard
            label="ตัวกรอง"
            value={requestedRound ? "1" : "ทั้งหมด"}
            tone={requestedRound ? "action" : "muted"}
            description="ใช้แท็บเพื่อดูเฉพาะรอบที่ต้องการ"
          />
          <FigmaMetricCard
            label="การแก้ไข"
            value="อ่านอย่างเดียว"
            tone="muted"
            description="หน้านี้ไม่มีงานให้นักศึกษาส่งเพิ่ม"
          />
        </div>
      ) : null}
      <StudentReadabilitySummary
        title="สรุปผลที่แสดงอยู่"
        description="ช่วยแยกผลที่อ่านได้แล้วออกจากรอบที่ยังรอคะแนนหรือข้อเสนอแนะจากกรรมการ"
        items={[
          {
            label: "อ่านได้แล้ว",
            value: presentationAttempts.length,
            detail: "รอบที่มีคะแนนหรือข้อเสนอแนะบันทึกแล้ว",
            tone: "done"
          },
          {
            label: "รอคะแนน",
            value: waitingResultCount,
            detail: "รอบที่ยังไม่มีข้อมูลให้แสดง ไม่ใช่งานที่นักศึกษาต้องกด",
            tone: "waiting"
          },
          {
            label: "ตัวกรอง",
            value: requestedRound ? "1" : "ทั้งหมด",
            detail: "ใช้แท็บด้านล่างเพื่อดูเฉพาะรอบที่ต้องการ",
            tone: "info"
          },
          {
            label: "การแก้ไข",
            value: "อ่านอย่างเดียว",
            detail: "คะแนนและข้อเสนอแนะมาจากกรรมการ ไม่เปิดให้แก้จากหน้านี้",
            tone: "locked"
          }
        ]}
      />
      <nav className="panel flex flex-wrap gap-2 text-sm" aria-label="เลือกดูข้อเสนอแนะตามรอบสอบ">
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
      {displayedPresentationResults.length ? (
        <section className="panel">
          <h2 className="font-semibold">{requestedRound ? `ผลการประเมิน${assessmentLabel(displayedPresentationResults[0]?.attempt.assessmentRound?.roundType)}` : "ผลการประเมินรอบสอบความก้าวหน้าและสอบขั้นสุดท้าย"}</h2>
          <div className="mt-3 space-y-4">
            {displayedPresentationResults.map((result) => (
              <div key={result.attempt.id} id={result.anchor} className={`scroll-mt-24 rounded-md border p-3 ${requestedRound ? "border-brand bg-paper" : "border-line"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{assessmentLabel(result.attempt.assessmentRound?.roundType)}</h3>
                    <p className="mt-1 text-sm text-muted">กรรมการบันทึกคะแนน {result.submittedCount}/{result.evaluatorCount} คน</p>
                  </div>
                  <div className="rounded-md border border-line bg-paper px-3 py-2 text-sm font-semibold">
                    {result.showScore ? `${formatScore(result.averageScore)} / 100` : "ยังไม่มีคะแนนที่บันทึก"}
                  </div>
                </div>
                {result.showScore || result.showFeedback || result.submittedCount > 0 ? (
                  <div className="mt-3 space-y-2">
                    {result.attempt.evaluatorAssignments
                    .filter((assignment) => assignment.scoreSubmission?.overallComment || assignment.scoreSubmission?.status === "SUBMITTED" || assignment.scoreSubmission?.status === "LOCKED")
                    .map((assignment) => (
                      <div key={assignment.id} className="rounded-md border border-line bg-paper p-3 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="font-medium">{assignment.evaluatorDisplayNameSnapshot}</div>
                          {result.showScore && assignment.scoreSubmission ? (
                            <div className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs font-semibold">
                              {formatScore(Number(assignment.scoreSubmission.totalScore))} / 100
                            </div>
                          ) : null}
                        </div>
                        {result.showScore && assignment.scoreSubmission?.scoreItems.length ? (
                          <div className="mt-3 overflow-hidden rounded-md border border-line">
                            <div className="grid grid-cols-[minmax(0,1fr)_96px] bg-surface px-3 py-2 text-xs font-semibold text-muted">
                              <span>เกณฑ์ประเมิน</span>
                              <span className="text-right">คะแนน</span>
                            </div>
                            {assignment.scoreSubmission.scoreItems.map((scoreItem) => (
                              <div key={scoreItem.id} className="grid grid-cols-[minmax(0,1fr)_96px] gap-3 border-t border-line px-3 py-2">
                                <div>
                                  <div className="font-medium">{scoreItem.rubricItem.itemLabelTh}</div>
                                  {scoreItem.rubricItem.evidenceHint ? <div className="mt-1 text-xs text-muted">{scoreItem.rubricItem.evidenceHint}</div> : null}
                                </div>
                                <div className="text-right font-semibold">
                                  {formatScore(Number(scoreItem.pointsAwarded))} / {formatScore(Number(scoreItem.rubricItem.points))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : result.showScore ? (
                          <p className="mt-2 text-muted">ยังไม่มีรายละเอียดรายการคะแนน</p>
                        ) : null}
                        {assignment.scoreSubmission?.overallComment ? (
                          <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0" value={assignment.scoreSubmission.overallComment} />
                        ) : (
                          <p className="mt-1 text-muted">ยังไม่มีข้อเสนอแนะที่เปิดเผย</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-md border border-line bg-surface p-3 text-sm text-muted">รอบนี้ยังไม่มีคะแนนหรือข้อเสนอแนะที่กรรมการบันทึกไว้</p>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : requestedRound ? (
        <section className="panel">
          <h2 className="font-semibold">ยังไม่มีข้อมูลรอบนี้</h2>
          <p className="mt-2 text-sm text-muted">ระบบยังไม่พบผลหรือข้อเสนอแนะสำหรับรอบที่เลือก</p>
        </section>
      ) : null}
    </div>
  );
}
