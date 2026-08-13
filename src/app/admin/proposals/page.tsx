import Link from "next/link";
import { auth } from "@/auth";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { AdminProposalDecisionForm } from "@/components/ui/AdminProposalDecisionForm";
import { AdminOperationalSummary } from "@/components/ui/AdminOperationalQueue";
import { InfoAlert, WarningAlert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { NextActionCard } from "@/components/ui/NextActionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProposalLifecycleActionForm } from "@/components/ui/ProposalLifecycleActionForm";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
import { getRoundEligibility } from "@/lib/assessments/roundEligibility";
import { formatThaiDateTime24 } from "@/lib/format/dateTime";
import { shouldAlertAdminForFailVotes } from "@/lib/lifecycle/transitions";
import { proposalDecisionEditBlockReason } from "@/lib/proposals/proposalDecisionPresentation";
import { summarizeProposalScores } from "@/lib/scoring/proposalSummary";
import { submittedProposalVotes } from "@/lib/scoring/proposalDraftIntegrity";
import { isSubmittedScoreStatus } from "@/lib/scoring/scoreSubmissionStatus";
import { closeProposalRound, releaseFeedback, saveFinalDecision, unlockProposalRevisionDecision } from "../actions";

function decisionLabel(decision?: string | null) {
  if (decision === "PASS") return "ผ่าน";
  if (decision === "PASS_WITH_REVISION") return "ผ่านโดยให้แก้ไข";
  if (decision === "NOT_PASS") return "ไม่ผ่าน";
  return "ยังไม่ตัดสิน";
}

function proposalVoteLabel(vote: "PASS" | "REVISE" | "FAIL") {
  if (vote === "PASS") return "ผ่าน";
  if (vote === "REVISE") return "ให้แก้ไข";
  return "ไม่ผ่าน";
}

function nextDecisionStep(decision?: string | null) {
  if (decision === "PASS") return "ขั้นถัดไป: แต่งตั้งประธานกรรมการและกรรมการ";
  if (decision === "PASS_WITH_REVISION") return "ขั้นถัดไป: ให้นักศึกษาแก้ไขและส่งใหม่";
  if (decision === "NOT_PASS") return "ขั้นถัดไป: กลับสู่ขั้นร่างหัวข้อพร้อมเก็บประวัติ";
  return "ตรวจสอบผลและบันทึกผลตัดสินสุดท้าย";
}

function roundStatusLabel(status: string) {
  if (status === "SCORING_CLOSED") return "ปิดรอบแล้ว";
  if (status === "SCORING_OPEN") return "เปิดให้ประเมิน";
  if (status === "RELEASED") return "เผยแพร่ข้อเสนอแนะแล้ว";
  return status;
}

export default async function AdminProposalsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return <div className="panel">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div>;
  const params = (await searchParams) ?? {};

  const rounds = await prisma.assessmentRound.findMany({
    where: { roundType: "PROPOSAL" },
    orderBy: { updatedAt: "desc" },
    include: {
      closedByAdmin: true,
      attempts: {
        orderBy: [{ attemptNo: "desc" }, { createdAt: "desc" }],
        include: {
          project: { include: { student: true, committeeAssignments: true } },
          scoreRelease: true,
          proposalResult: { include: { decidedByAdmin: true } },
          evaluatorAssignments: {
            include: {
              teacher: true,
              scoreSubmission: { include: { proposalDecision: true } }
            }
          },
          presentationSubmission: true,
          proposalVotes: { include: { teacher: true }, orderBy: { submittedAt: "desc" } }
        }
      }
    }
  });

  const safeRounds = rounds.map((round) => ({
    ...round,
    attempts: round.attempts.map((attempt) => ({
      ...attempt,
      proposalVotes: submittedProposalVotes(attempt.proposalVotes, attempt.evaluatorAssignments),
      evaluatorAssignments: attempt.evaluatorAssignments.map((assignment) => ({
        ...assignment,
        scoreSubmission:
          assignment.status === "SUBMITTED"
          && isSubmittedScoreStatus(assignment.scoreSubmission?.status)
            ? assignment.scoreSubmission
            : null
      }))
    }))
  }));
  const allAttempts = safeRounds.flatMap((round) => round.attempts);
  const latestAttemptIdByProject = new Map<string, string>();
  for (const attempt of allAttempts) {
    const currentId = latestAttemptIdByProject.get(attempt.projectId);
    const current = currentId ? allAttempts.find((candidate) => candidate.id === currentId) : null;
    if (!current || attempt.attemptNo > current.attemptNo) latestAttemptIdByProject.set(attempt.projectId, attempt.id);
  }
  const currentAttempts = allAttempts.filter((attempt) => latestAttemptIdByProject.get(attempt.projectId) === attempt.id);
  const hasProposalAttempts = allAttempts.length > 0;
  const latestProposalRound = safeRounds[0];
  const progress1Eligibility = latestProposalRound ? await getRoundEligibility(latestProposalRound.courseOfferingId, "PROGRESS_1") : { eligible: [], notReady: [] };
  const missingProposalProjects = latestProposalRound
    ? await prisma.project.findMany({
        where: { courseOfferingId: latestProposalRound.courseOfferingId, presentationSubmissions: { none: {} } },
        orderBy: { student: { studentCode: "asc" } },
        select: { id: true, student: { select: { studentCode: true, firstNameTh: true, lastNameTh: true } } }
      })
    : [];
  const waitingDecisionCount = currentAttempts.filter((attempt) => !attempt.proposalResult).length;
  const approvedWithoutCommitteeCount = currentAttempts.filter((attempt) => {
    if (attempt.project.status !== "TOPIC_APPROVED") return false;
    const roles = new Set(attempt.project.committeeAssignments.filter((assignment) => assignment.active).map((assignment) => assignment.role));
    return !roles.has("HEAD") || !roles.has("MEMBER");
  }).length;
  const failAlertCount = currentAttempts.filter((attempt) => shouldAlertAdminForFailVotes(attempt.proposalVotes)).length;
  const missingScoreCount = currentAttempts.filter((attempt) => {
    const submitted = attempt.evaluatorAssignments.filter((assignment) => isSubmittedScoreStatus(assignment.scoreSubmission?.status)).length;
    return submitted < attempt.evaluatorAssignments.length;
  }).length;
  const releasedCount = allAttempts.filter((attempt) => attempt.scoreRelease).length;
  const decidedCount = allAttempts.filter((attempt) => attempt.proposalResult).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="สรุปผลการสอบหัวข้อ"
        description="หน้านี้ใช้สำหรับปิดรอบการเสนอหัวข้อ ตรวจสอบคะแนนและผลพิจารณา แล้วบันทึกผลการตัดสินสุดท้ายเท่านั้น"
      />
      <ActionFeedback success={params.success} error={params.error} />

      {hasProposalAttempts ? (
        <>
          <AdminOperationalSummary
            title="สรุปปฏิบัติการ Proposal"
            description="แยกงานที่ Admin ต้องตัดสิน ออกจากงานที่รอคะแนนอาจารย์หรือเสร็จแล้ว"
            metrics={[
              { label: "รอตัดสิน", count: waitingDecisionCount, tone: waitingDecisionCount ? "action" : "completed", description: "มีคะแนน/เอกสารแล้วแต่ยังไม่มีมติสุดท้าย" },
              { label: "คะแนนยังไม่ครบ", count: missingScoreCount, tone: missingScoreCount ? "waiting" : "completed", description: "ไม่ใช่ blocker เสมอไป แต่ควรตรวจสอบก่อนปิดรอบ" },
              { label: "ไม่ผ่านตั้งแต่ 50%", count: failAlertCount, tone: failAlertCount ? "exception" : "completed", description: "ต้องอ่านเหตุผลและมติประชุมอย่างระมัดระวัง" },
              { label: "ตัดสินแล้ว", count: decidedCount, tone: "completed", description: "มี final decision แล้ว" },
              { label: "เปิดผลแล้ว", count: releasedCount, tone: "completed", description: "นักศึกษาเห็นข้อเสนอแนะแล้ว" }
            ]}
          />
          <NextActionCard
            action={{
              title: waitingDecisionCount ? "ตรวจสอบผลและบันทึกผลตัดสินสุดท้าย" : "พร้อมเข้าสู่ขั้นตอนถัดไป",
              description: waitingDecisionCount
                ? `มี ${waitingDecisionCount} โครงงานที่ยังรอผู้ดูแลระบบตัดสินผลสุดท้าย`
                : "รายการที่ตัดสินผ่านแล้วสามารถไปแต่งตั้งประธานและกรรมการได้",
              href: waitingDecisionCount ? undefined : "/admin/committee",
              actionLabel: "ไปหน้าแต่งตั้งกรรมการ",
              tone: waitingDecisionCount ? "warning" : "success"
            }}
          />
          {latestProposalRound && ["SCORING_CLOSED", "RELEASED"].includes(latestProposalRound.status) ? (
            <InfoAlert title="ขั้นตอนถัดไปหลังปิดรอบการเสนอหัวข้อ">
              {waitingDecisionCount ? "ยังมีโครงงานรอผู้ดูแลระบบตัดสินผลการเสนอหัวข้อ" : approvedWithoutCommitteeCount ? "มีโครงงานที่ผ่านแล้วรอแต่งตั้งประธานและกรรมการ" : progress1Eligibility.eligible.length ? (
                <Link className="button mt-2 inline-flex" href="/admin/rounds">ไปเปิดรอบสอบความก้าวหน้าครั้งที่ 1</Link>
              ) : "ตรวจสอบโครงงานที่ยังไม่พร้อมก่อนเปิดรอบสอบความก้าวหน้าครั้งที่ 1"}
            </InfoAlert>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            {failAlertCount ? (
              <WarningAlert title={`มีเอกสารเสนอหัวข้อที่มีผลไม่ผ่านอย่างน้อย 50% จำนวน ${failAlertCount} รายการ`}>
                กรุณาตรวจผลโหวต ข้อเสนอแนะ และเหตุผลก่อนเลือกมติสุดท้าย
              </WarningAlert>
            ) : (
              <InfoAlert title="ไม่มีรายการไม่ผ่านตั้งแต่ 50%" />
            )}
            {missingScoreCount ? (
              <WarningAlert title={`มีรายการที่คะแนนยังไม่ครบ ${missingScoreCount} รายการ`}>
                คะแนนที่ขาดจะไม่ถูกนำไปคำนวณค่าเฉลี่ย แต่ควรตรวจสอบก่อนปิดรอบ
              </WarningAlert>
            ) : (
              <InfoAlert title="ไม่มีรายการคะแนนขาด" />
            )}
            {waitingDecisionCount ? (
              <WarningAlert title={`รอผู้ดูแลระบบตัดสิน ${waitingDecisionCount} รายการ`} />
            ) : (
              <InfoAlert title="ไม่มีรายการรอ Admin ตัดสิน" />
            )}
          </div>
        </>
      ) : (
        <section className="panel">
          <EmptyState
            title="ยังไม่มีรายการเสนอหัวข้อในรอบนี้"
            description={rounds.length ? "มีรอบการเสนอหัวข้อแล้ว แต่ยังไม่มีนักศึกษาส่งเอกสารเสนอหัวข้อเข้ามา จึงยังไม่มีคะแนน ผลพิจารณา หรือผลตัดสินสุดท้ายให้สรุป" : "ยังไม่มีรอบการเสนอหัวข้อ เมื่อเปิดรอบและมีนักศึกษาส่งเอกสารเสนอหัวข้อแล้ว รายการสรุปผลจะแสดงที่นี่"}
          />
        </section>
      )}

      {safeRounds.length ? (
        safeRounds.map((round) => {
          const closed = round.status === "SCORING_CLOSED" || round.status === "RELEASED";
          return (
            <section key={round.id} className="panel space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{round.name}</h2>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${closed ? "badge-ok" : "badge-red"}`}>
                      {roundStatusLabel(round.status)}
                    </span>
                  </div>
                  {closed && round.closedAt ? (
                    <p className="mt-1 text-sm text-muted">
                      ปิดรอบเมื่อ: {formatThaiDateTime24(round.closedAt)}
                      {round.closedByAdmin ? ` | ผู้ปิดรอบ: ${round.closedByAdmin.email ?? round.closedByAdmin.name ?? "ผู้ดูแลระบบ"}` : ""}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted">
                      {closed ? "ปิดรอบแล้ว แต่ยังไม่มีเวลา closed_at ในข้อมูลเดิม" : "ยังเปิดอยู่ เมื่อปิดรอบแล้วอาจารย์จะไม่สามารถแก้คะแนนได้ตามปกติ"}
                    </p>
                  )}
                </div>
                <form action={closeProposalRound}>
                  <input type="hidden" name="round_id" value={round.id} />
                  {!closed && missingProposalProjects.length ? (
                    <label className="mb-2 flex items-center gap-2 text-xs text-muted">
                      <input type="checkbox" name="acknowledge_missing_projects" value="yes" />
                      รับทราบรายชื่อนักศึกษาที่ยังไม่ส่ง Proposal แล้ว
                    </label>
                  ) : null}
                  <SubmitButton
                    disabled={closed}
                    pendingText="กำลังปิดรอบ..."
                    confirmMessage="ยืนยันการปิดรอบการเสนอหัวข้อหรือไม่? หลังจากปิดรอบแล้ว อาจารย์จะไม่สามารถแก้คะแนนได้ เว้นแต่ผู้ดูแลระบบเปิดสิทธิ์ใหม่"
                  >
                    {closed ? "ปิดรอบแล้ว" : "ปิดรอบการเสนอหัวข้อ"}
                  </SubmitButton>
                </form>
              </div>

              {!closed && missingProposalProjects.length ? (
                <WarningAlert title={`มีนักศึกษายังไม่ส่ง Proposal ${missingProposalProjects.length} ราย`}>
                  <div className="space-y-1">
                    <p>ก่อนปิดรอบ โปรดยืนยันว่ารับทราบรายชื่อนักศึกษาที่ค้างส่งแล้ว</p>
                    <ul className="list-disc pl-5">
                      {missingProposalProjects.slice(0, 10).map((project) => (
                        <li key={project.id}>{project.student?.studentCode} {project.student?.firstNameTh} {project.student?.lastNameTh}</li>
                      ))}
                    </ul>
                  </div>
                </WarningAlert>
              ) : null}

              {closed ? (
                <InfoAlert title="ปิดรอบแล้ว">
                  ตรวจสอบผลและบันทึกผลตัดสินสุดท้าย หรือไปขั้นตอนแต่งตั้งกรรมการสำหรับหัวข้อที่ผ่าน
                </InfoAlert>
              ) : null}

              {round.attempts.length ? (
                <>
              <div className="grid gap-3 md:hidden">
                {round.attempts.map((attempt) => {
                  const summary = summarizeProposalScores(
                    attempt.evaluatorAssignments.length,
                    attempt.evaluatorAssignments
                      .map((assignment) => assignment.scoreSubmission)
                      .filter(Boolean)
                      .map((score) => ({
                        totalScore: Number(score!.totalScore),
                        status: score!.status,
                        decision: score!.proposalDecision?.decision,
                        reason: score!.proposalDecision?.reason,
                        overallComment: score!.overallComment
                      }))
                  );
                  const failVotes = attempt.proposalVotes.filter((vote) => vote.vote === "FAIL").length;
                  const reviseVotes = attempt.proposalVotes.filter((vote) => vote.vote === "REVISE").length;
                  const passVotes = attempt.proposalVotes.filter((vote) => vote.vote === "PASS").length;
                  const totalVotes = attempt.proposalVotes.length;
                  const failRatio = totalVotes ? Math.round((failVotes / totalVotes) * 100) : 0;
                  const finalDecision = attempt.proposalResult?.finalDecision;
                  const decided = Boolean(attempt.proposalResult);
                  const isLatestAttempt = latestAttemptIdByProject.get(attempt.projectId) === attempt.id;
                  const certifiedRevision = finalDecision === "PASS_WITH_REVISION"
                    && attempt.presentationSubmission?.status === "LOCKED"
                    && attempt.project.status === "TOPIC_APPROVED";
                  const decisionEditBlockReason = proposalDecisionEditBlockReason({
                    finalDecision,
                    projectStatus: attempt.project.status,
                    submissionStatus: attempt.presentationSubmission?.status,
                    hasActiveCommittee: attempt.project.committeeAssignments.some((assignment) => assignment.active)
                  });

                  return (
                    <article key={attempt.id} className="rounded-xl border border-line bg-surface p-4 shadow-sm">
                      <dl className="grid gap-4 text-sm">
                        <div>
                          <dt className="text-xs font-semibold text-muted">นักศึกษา</dt>
                          <dd className="mt-1">
                            <div className="font-semibold">{attempt.project.student.studentCode}</div>
                            <div className="text-muted">
                              {attempt.project.student.firstNameTh} {attempt.project.student.lastNameTh}
                            </div>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold text-muted">หัวข้อ</dt>
                          <dd className="mt-1 break-words font-medium">{attempt.presentationSubmission?.titleTh ?? "ยังไม่มีชื่อหัวข้อ"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold text-muted">สถานะ</dt>
                          <dd className="mt-2">
                            <StatusBadge status={attempt.project.status} />
                            <div className="mt-2 text-xs text-muted">
                              ครั้งที่ {attempt.attemptNo} · {attempt.attemptType === "REPROPOSAL" ? "Re-proposal" : "Proposal"}
                            </div>
                          </dd>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg border border-line bg-paperSoft p-3">
                            <dt className="text-xs font-semibold text-muted">คะแนน</dt>
                            <dd className="mt-2 space-y-1">
                              <div>ส่งแล้ว {summary.submittedCount}</div>
                              <div>ขาด {summary.missingCount}</div>
                              <div>เฉลี่ย {summary.averageScore}</div>
                            </dd>
                          </div>
                          <div className="rounded-lg border border-line bg-paperSoft p-3">
                            <dt className="text-xs font-semibold text-muted">ผลโหวต</dt>
                            <dd className="mt-2 space-y-1">
                              <div>{proposalVoteLabel("PASS")} {passVotes}</div>
                              <div>{proposalVoteLabel("REVISE")} {reviseVotes}</div>
                              <div className={failRatio >= 50 ? "font-semibold text-red-700" : ""}>{proposalVoteLabel("FAIL")} {failVotes} ({failRatio}%)</div>
                            </dd>
                          </div>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold text-muted">มติสุดท้าย</dt>
                          <dd className="mt-1">
                            <div className="font-semibold">{decisionLabel(finalDecision)}</div>
                            {attempt.proposalResult ? (
                              <div className="mt-1 break-words text-xs leading-5 text-muted">
                                ผู้บันทึก: {attempt.proposalResult.decidedByAdmin.email ?? attempt.proposalResult.decidedByAdmin.name ?? "Admin"}
                                <br />
                                เวลาบันทึก: {formatThaiDateTime24(attempt.proposalResult.decidedAt)}
                              </div>
                            ) : null}
                            {attempt.proposalResult?.finalDecisionReason ? (
                              <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-xs text-muted" value={attempt.proposalResult.finalDecisionReason} />
                            ) : null}
                            <div className="mt-2 rounded-md border border-line bg-paper p-2 text-xs">{nextDecisionStep(finalDecision)}</div>
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-4 rounded-lg border border-line bg-paperSoft p-3">
                        <div className="mb-2 text-xs font-semibold text-muted">การทำงาน</div>
                        {!isLatestAttempt ? (
                          <InfoAlert title="ประวัติการสอบหัวข้อ">
                            Attempt นี้ถูกล็อกแบบอ่านอย่างเดียว การบันทึกมติและคะแนนใช้ได้เฉพาะ Attempt ล่าสุด
                          </InfoAlert>
                        ) : certifiedRevision ? (
                          <ProposalLifecycleActionForm action={unlockProposalRevisionDecision} className="grid gap-2">
                            <input type="hidden" name="attempt_id" value={attempt.id} />
                            <input name="reason" required placeholder="เหตุผลที่ต้องปลดล็อกมติ" />
                            <SubmitButton className="button-secondary" pendingText="กำลังปลดล็อก..." confirmMessage="ยืนยันการปลดล็อกมติและส่ง Proposal กลับเข้าสู่ขั้นแก้ไขหรือไม่?" autoRecovery={false}>
                              ปลดล็อกมติ
                            </SubmitButton>
                          </ProposalLifecycleActionForm>
                        ) : decisionEditBlockReason ? (
                          <InfoAlert title="มติถูกล็อกแล้ว">{decisionEditBlockReason}</InfoAlert>
                        ) : (
                          <AdminProposalDecisionForm
                            key={`${attempt.id}:${finalDecision ?? "undecided"}`}
                            action={saveFinalDecision}
                            attemptId={attempt.id}
                            formInstance="mobile"
                            studentLabel={`${attempt.project.student.studentCode} ${attempt.project.student.firstNameTh} ${attempt.project.student.lastNameTh}`}
                            initialDecision={finalDecision}
                            initialReason={attempt.proposalResult?.finalDecisionReason}
                            isEditing={decided}
                            missingScoreCount={summary.missingCount}
                          />
                        )}
                        {isLatestAttempt && attempt.proposalResult ? <form action={releaseFeedback} className="mt-3">
                          <input type="hidden" name="attempt_id" value={attempt.id} />
                          <SubmitButton
                            className="button-secondary w-full"
                            disabled={Boolean(attempt.scoreRelease)}
                            pendingText="กำลังเปิดข้อเสนอแนะ..."
                            confirmMessage={`ยืนยันเปิดข้อเสนอแนะของ ${attempt.project.student.studentCode} ให้นักศึกษาเห็นหรือไม่?`}
                          >
                            {attempt.scoreRelease ? "เปิดข้อเสนอแนะแล้ว" : "เปิดข้อเสนอแนะให้นักศึกษาเห็น"}
                          </SubmitButton>
                        </form> : null}
                        <details className="mt-3 rounded-md border border-line bg-surface p-2">
                          <summary className="cursor-pointer font-medium">รายละเอียดคะแนน / ข้อเสนอแนะ / ประวัติ</summary>
                          <div className="mt-2 space-y-2 text-xs text-muted">
                            {attempt.evaluatorAssignments.map((assignment) => (
                              <div key={assignment.id} className="rounded border border-line p-2">
                                <div className="font-medium text-ink">{assignment.evaluatorDisplayNameSnapshot}</div>
                                <div>สถานะ: {isSubmittedScoreStatus(assignment.scoreSubmission?.status) ? "ส่งแล้ว" : "ยังไม่ส่ง"}</div>
                                <div>คะแนน: {assignment.scoreSubmission ? Number(assignment.scoreSubmission.totalScore) : "-"}</div>
                                <div>ข้อเสนอแนะ:</div>
                                <MarkdownLatexViewer className="mt-1 border-0 bg-transparent p-0 text-xs" value={assignment.scoreSubmission?.overallComment} emptyText="-" />
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="responsive-table table-fixed">
                  <colgroup>
                    <col className="w-[36%]" />
                    <col className="w-[25%]" />
                    <col className="w-[39%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-line text-left text-muted">
                      <th>โครงการ</th>
                      <th>ผลประเมิน</th>
                      <th>มติและขั้นตอนถัดไป</th>
                    </tr>
                  </thead>
                  <tbody>
                    {round.attempts.map((attempt) => {
                      const summary = summarizeProposalScores(
                        attempt.evaluatorAssignments.length,
                        attempt.evaluatorAssignments
                          .map((assignment) => assignment.scoreSubmission)
                          .filter(Boolean)
                          .map((score) => ({
                            totalScore: Number(score!.totalScore),
                            status: score!.status,
                            decision: score!.proposalDecision?.decision,
                            reason: score!.proposalDecision?.reason,
                            overallComment: score!.overallComment
                          }))
                      );
                      const failVotes = attempt.proposalVotes.filter((vote) => vote.vote === "FAIL").length;
                      const reviseVotes = attempt.proposalVotes.filter((vote) => vote.vote === "REVISE").length;
                      const passVotes = attempt.proposalVotes.filter((vote) => vote.vote === "PASS").length;
                      const totalVotes = attempt.proposalVotes.length;
                      const failRatio = totalVotes ? Math.round((failVotes / totalVotes) * 100) : 0;
                      const finalDecision = attempt.proposalResult?.finalDecision;
                      const decided = Boolean(attempt.proposalResult);
                      const isLatestAttempt = latestAttemptIdByProject.get(attempt.projectId) === attempt.id;
                      const certifiedRevision = finalDecision === "PASS_WITH_REVISION"
                        && attempt.presentationSubmission?.status === "LOCKED"
                        && attempt.project.status === "TOPIC_APPROVED";
                      const decisionEditBlockReason = proposalDecisionEditBlockReason({
                        finalDecision,
                        projectStatus: attempt.project.status,
                        submissionStatus: attempt.presentationSubmission?.status,
                        hasActiveCommittee: attempt.project.committeeAssignments.some((assignment) => assignment.active)
                      });

                      return (
                        <tr key={attempt.id} className="border-b border-line align-top last:border-b-0">
                          <td>
                            <div className="text-base font-semibold text-ink">
                              {attempt.project.student.studentCode}
                            </div>
                            <div className="mt-0.5 text-sm text-muted">
                              {attempt.project.student.firstNameTh} {attempt.project.student.lastNameTh}
                            </div>
                            <div className="mt-3 break-words text-sm font-medium leading-6">
                              {attempt.presentationSubmission?.titleTh ?? "ยังไม่มีชื่อหัวข้อ"}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <StatusBadge status={attempt.project.status} />
                              <span className="text-xs text-muted">
                                ครั้งที่ {attempt.attemptNo} · {attempt.attemptType === "REPROPOSAL" ? "Re-proposal" : "Proposal"}
                              </span>
                            </div>
                          </td>
                          <td>
                            <dl className="grid grid-cols-3 gap-2 text-center">
                              <div className="rounded-md border border-line bg-paperSoft px-2 py-3">
                                <dt className="text-xs text-muted">เฉลี่ย</dt>
                                <dd className="mt-1 text-lg font-semibold text-ink">{summary.averageScore}</dd>
                              </div>
                              <div className="rounded-md border border-line bg-paperSoft px-2 py-3">
                                <dt className="text-xs text-muted">ส่งแล้ว</dt>
                                <dd className="mt-1 text-lg font-semibold text-ink">{summary.submittedCount}</dd>
                              </div>
                              <div className={`rounded-md border px-2 py-3 ${summary.missingCount ? "border-amber-200 bg-amber-50" : "border-line bg-paperSoft"}`}>
                                <dt className="text-xs text-muted">ขาด</dt>
                                <dd className={`mt-1 text-lg font-semibold ${summary.missingCount ? "text-amber-900" : "text-ink"}`}>{summary.missingCount}</dd>
                              </div>
                            </dl>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                              <div>{proposalVoteLabel("PASS")} <strong>{passVotes}</strong></div>
                              <div>{proposalVoteLabel("REVISE")} <strong>{reviseVotes}</strong></div>
                              <div className={failRatio >= 50 ? "font-semibold text-red-700" : ""}>{proposalVoteLabel("FAIL")} <strong>{failVotes}</strong> ({failRatio}%)</div>
                            </div>
                            <details className="mt-4 rounded-md border border-line bg-surface p-3">
                              <summary className="cursor-pointer text-sm font-medium">ดูคะแนนและข้อเสนอแนะรายคน</summary>
                              <div className="mt-3 space-y-2 text-xs text-muted">
                                {attempt.evaluatorAssignments.map((assignment) => (
                                  <div key={assignment.id} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
                                    <div className="font-medium text-ink">{assignment.evaluatorDisplayNameSnapshot}</div>
                                    <div>สถานะ: {isSubmittedScoreStatus(assignment.scoreSubmission?.status) ? "ส่งแล้ว" : "ยังไม่ส่ง"}</div>
                                    <div>คะแนน: {assignment.scoreSubmission ? Number(assignment.scoreSubmission.totalScore) : "-"}</div>
                                    <MarkdownLatexViewer className="mt-1 border-0 bg-transparent p-0 text-xs" value={assignment.scoreSubmission?.overallComment} emptyText="ไม่มีข้อเสนอแนะ" />
                                  </div>
                                ))}
                              </div>
                            </details>
                          </td>
                          <td>
                            <div className="mb-3 rounded-md border border-line bg-paperSoft p-3">
                              <div className="text-xs font-semibold text-muted">มติปัจจุบัน</div>
                              <div className="mt-1 font-semibold text-ink">{decisionLabel(finalDecision)}</div>
                              {attempt.proposalResult ? (
                                <div className="mt-1 text-xs leading-5 text-muted">
                                  ผู้บันทึก: {attempt.proposalResult.decidedByAdmin.email ?? attempt.proposalResult.decidedByAdmin.name ?? "Admin"}<br />
                                  เวลาบันทึก: {formatThaiDateTime24(attempt.proposalResult.decidedAt)}
                                </div>
                              ) : null}
                              {attempt.proposalResult?.finalDecisionReason ? (
                                <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-xs text-muted" value={attempt.proposalResult.finalDecisionReason} />
                              ) : null}
                              <div className="mt-2 text-xs leading-5 text-muted">{nextDecisionStep(finalDecision)}</div>
                            </div>
                            {!isLatestAttempt ? (
                              <InfoAlert title="ประวัติการสอบหัวข้อ">
                                Attempt นี้ถูกล็อกแบบอ่านอย่างเดียว การบันทึกมติและคะแนนใช้ได้เฉพาะ Attempt ล่าสุด
                              </InfoAlert>
                            ) : certifiedRevision ? (
                              <ProposalLifecycleActionForm action={unlockProposalRevisionDecision} className="grid gap-2">
                                <input type="hidden" name="attempt_id" value={attempt.id} />
                                <input name="reason" required placeholder="เหตุผลที่ต้องปลดล็อกมติ" />
                                <SubmitButton className="button-secondary" pendingText="กำลังปลดล็อก..." confirmMessage="ยืนยันการปลดล็อกมติและส่ง Proposal กลับเข้าสู่ขั้นแก้ไขหรือไม่?" autoRecovery={false}>
                                  ปลดล็อกมติ
                                </SubmitButton>
                              </ProposalLifecycleActionForm>
                            ) : decisionEditBlockReason ? (
                              <InfoAlert title="มติถูกล็อกแล้ว">{decisionEditBlockReason}</InfoAlert>
                            ) : (
                              <AdminProposalDecisionForm
                                key={`${attempt.id}:${finalDecision ?? "undecided"}`}
                                action={saveFinalDecision}
                                attemptId={attempt.id}
                                formInstance="desktop"
                                studentLabel={`${attempt.project.student.studentCode} ${attempt.project.student.firstNameTh} ${attempt.project.student.lastNameTh}`}
                                initialDecision={finalDecision}
                                initialReason={attempt.proposalResult?.finalDecisionReason}
                                isEditing={decided}
                                missingScoreCount={summary.missingCount}
                              />
                            )}
                            {isLatestAttempt && attempt.proposalResult ? <form action={releaseFeedback} className="mt-3">
                              <input type="hidden" name="attempt_id" value={attempt.id} />
                              <SubmitButton
                                className="button-secondary w-full"
                                disabled={Boolean(attempt.scoreRelease)}
                                pendingText="กำลังเปิดข้อเสนอแนะ..."
                                confirmMessage={`ยืนยันเปิดข้อเสนอแนะของ ${attempt.project.student.studentCode} ให้นักศึกษาเห็นหรือไม่?`}
                              >
                                {attempt.scoreRelease ? "เปิดข้อเสนอแนะแล้ว" : "เปิดข้อเสนอแนะให้นักศึกษาเห็น"}
                              </SubmitButton>
                            </form> : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
                </>
              ) : (
                <EmptyState title="ยังไม่มีรายการเสนอหัวข้อในรอบนี้" description="เมื่อมีนักศึกษาส่งเอกสารเสนอหัวข้อ รายการคะแนน ผลพิจารณา และผลตัดสินสุดท้ายจะแสดงในรอบนี้" />
              )}
            </section>
          );
        })
      ) : (
        <EmptyState title="ยังไม่มีรอบการเสนอหัวข้อ" description="เมื่อสร้างรอบการเสนอหัวข้อแล้ว รายการสรุปผลจะแสดงที่หน้านี้" />
      )}
    </div>
  );
}
