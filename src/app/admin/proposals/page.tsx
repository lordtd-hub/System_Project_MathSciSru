import { auth } from "@/auth";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { InfoAlert, WarningAlert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { NextActionCard } from "@/components/ui/NextActionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
import { getRoundEligibility } from "@/lib/assessments/roundEligibility";
import { shouldAlertAdminForFailVotes } from "@/lib/lifecycle/transitions";
import { summarizeProposalScores } from "@/lib/scoring/proposalSummary";
import { closeProposalRound, releaseFeedback, saveFinalDecision } from "../actions";

function decisionLabel(decision?: string | null) {
  if (decision === "PASS") return "ผ่าน";
  if (decision === "PASS_WITH_REVISION") return "ผ่านโดยให้แก้ไข";
  if (decision === "NOT_PASS") return "ไม่ผ่าน";
  return "ยังไม่ตัดสิน";
}

function nextDecisionStep(decision?: string | null) {
  if (decision === "PASS") return "ขั้นถัดไป: แต่งตั้ง HEAD และ MEMBER";
  if (decision === "PASS_WITH_REVISION") return "ขั้นถัดไป: ให้นักศึกษาแก้ไขและส่งใหม่";
  if (decision === "NOT_PASS") return "ขั้นถัดไป: กลับสู่ DRAFT พร้อมเก็บประวัติ";
  return "ตรวจสอบผลและบันทึก final decision";
}

function roundStatusLabel(status: string) {
  if (status === "SCORING_CLOSED") return "ปิดรอบแล้ว";
  if (status === "SCORING_OPEN") return "เปิดให้ประเมิน";
  if (status === "RELEASED") return "เผยแพร่ feedback แล้ว";
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
        orderBy: { createdAt: "desc" },
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

  const allAttempts = rounds.flatMap((round) => round.attempts);
  const hasProposalAttempts = allAttempts.length > 0;
  const latestProposalRound = rounds[0];
  const progress1Eligibility = latestProposalRound ? await getRoundEligibility(latestProposalRound.courseOfferingId, "PROGRESS_1") : { eligible: [], notReady: [] };
  const waitingDecisionCount = allAttempts.filter((attempt) => !attempt.proposalResult).length;
  const approvedWithoutCommitteeCount = allAttempts.filter((attempt) => {
    if (attempt.project.status !== "TOPIC_APPROVED") return false;
    const roles = new Set(attempt.project.committeeAssignments.filter((assignment) => assignment.active).map((assignment) => assignment.role));
    return !roles.has("HEAD") || !roles.has("MEMBER");
  }).length;
  const failAlertCount = allAttempts.filter((attempt) => shouldAlertAdminForFailVotes(attempt.proposalVotes)).length;
  const missingScoreCount = allAttempts.filter((attempt) => {
    const submitted = attempt.evaluatorAssignments.filter((assignment) => assignment.scoreSubmission?.status === "SUBMITTED").length;
    return submitted < attempt.evaluatorAssignments.length;
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="สรุปผลการสอบหัวข้อ"
        description="หน้านี้ใช้สำหรับปิดรอบ Proposal ตรวจสอบคะแนนและ vote แล้วบันทึกผลการตัดสินสุดท้ายเท่านั้น"
      />
      <ActionFeedback success={params.success} error={params.error} />

      {hasProposalAttempts ? (
        <>
          <NextActionCard
            action={{
              title: waitingDecisionCount ? "ตรวจสอบผลและบันทึก final decision" : "พร้อมเข้าสู่ขั้นตอนถัดไป",
              description: waitingDecisionCount
                ? `มี ${waitingDecisionCount} โปรเจคที่ยังรอผู้ดูแลระบบตัดสินผลสุดท้าย`
                : "รายการที่ตัดสินผ่านแล้วสามารถไปแต่งตั้ง HEAD และ MEMBER ได้",
              href: waitingDecisionCount ? undefined : "/admin/committee",
              actionLabel: "ไปหน้าแต่งตั้งกรรมการ",
              tone: waitingDecisionCount ? "warning" : "success"
            }}
          />
          {latestProposalRound && ["SCORING_CLOSED", "RELEASED"].includes(latestProposalRound.status) ? (
            <InfoAlert title="ขั้นตอนถัดไปหลังปิดรอบ Proposal">
              {waitingDecisionCount ? "ยังมี project รอผู้ดูแลระบบตัดสินผล Proposal" : approvedWithoutCommitteeCount ? "มี project ที่ผ่านแล้วรอแต่งตั้ง HEAD/MEMBER" : progress1Eligibility.eligible.length ? (
                <a className="button mt-2 inline-flex" href="/admin/rounds">ไปเปิดรอบ Progress 1</a>
              ) : "ตรวจสอบ project ที่ยังไม่พร้อมก่อนเปิดรอบ Progress 1"}
            </InfoAlert>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            {failAlertCount ? (
              <WarningAlert title={`มี Proposal ที่ FAIL อย่างน้อย 50% จำนวน ${failAlertCount} รายการ`}>
                กรุณาตรวจ vote, comment และเหตุผลก่อนเลือก final decision
              </WarningAlert>
            ) : (
              <InfoAlert title="ไม่มีรายการ FAIL ≥ 50%" />
            )}
            {missingScoreCount ? (
              <WarningAlert title={`มีรายการที่คะแนนยังไม่ครบ ${missingScoreCount} รายการ`}>
                คะแนนที่ขาดจะไม่ถูกนำเข้า average แต่ควรตรวจสอบก่อนปิดรอบ
              </WarningAlert>
            ) : (
              <InfoAlert title="ไม่มีรายการคะแนนขาด" />
            )}
            {waitingDecisionCount ? (
              <WarningAlert title={`รอ Admin ตัดสิน ${waitingDecisionCount} รายการ`} />
            ) : (
              <InfoAlert title="ไม่มีรายการรอ Admin ตัดสิน" />
            )}
          </div>
        </>
      ) : (
        <section className="panel">
          <EmptyState
            title="ยังไม่มีรายการ Proposal ในรอบนี้"
            description={rounds.length ? "มีรอบ Proposal แล้ว แต่ยังไม่มีนักศึกษาส่ง Proposal เข้ามา จึงยังไม่มีคะแนน Vote หรือ final decision ให้สรุป" : "ยังไม่มีรอบ Proposal เมื่อเปิดรอบและมีนักศึกษาส่ง Proposal แล้ว รายการสรุปผลจะแสดงที่นี่"}
          />
        </section>
      )}

      {rounds.length ? (
        rounds.map((round) => {
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
                      closed_at: {round.closedAt.toLocaleString("th-TH")}
                      {round.closedByAdmin ? ` | closed_by: ${round.closedByAdmin.email ?? round.closedByAdmin.name ?? "Admin"}` : ""}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted">
                      {closed ? "ปิดรอบแล้ว แต่ยังไม่มีเวลา closed_at ในข้อมูลเดิม" : "ยังเปิดอยู่ เมื่อปิดรอบแล้วอาจารย์จะไม่สามารถแก้คะแนนได้ตามปกติ"}
                    </p>
                  )}
                </div>
                <form action={closeProposalRound}>
                  <input type="hidden" name="round_id" value={round.id} />
                  <SubmitButton
                    disabled={closed}
                    pendingText="กำลังปิดรอบ..."
                    confirmMessage="ยืนยันการปิดรอบ Proposal หรือไม่? หลังจากปิดรอบแล้ว อาจารย์จะไม่สามารถแก้คะแนนได้ เว้นแต่ผู้ดูแลระบบเปิดสิทธิ์ใหม่"
                  >
                    {closed ? "ปิดรอบแล้ว" : "ปิดรอบ Proposal"}
                  </SubmitButton>
                </form>
              </div>

              {closed ? (
                <InfoAlert title="ปิดรอบแล้ว">
                  ตรวจสอบผลและบันทึก final decision หรือไปขั้นตอนแต่งตั้งกรรมการสำหรับหัวข้อที่ผ่าน
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
                  const decisionConfirm =
                    finalDecision === "NOT_PASS" || finalDecision === "PASS"
                      ? "ยืนยันการบันทึกผลการตัดสินหรือไม่? ระบบจะเปลี่ยนสถานะโครงงานตามผลที่เลือกและบันทึกประวัติไว้"
                      : "ยืนยันการบันทึกผลการตัดสินหรือไม่?";

                  return (
                    <article key={attempt.id} className="rounded-xl border border-line bg-surface p-4 shadow-sm">
                      <dl className="grid gap-4 text-sm">
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">นักศึกษา</dt>
                          <dd className="mt-1">
                            <div className="font-semibold">{attempt.project.student.studentCode}</div>
                            <div className="text-muted">
                              {attempt.project.student.firstNameTh} {attempt.project.student.lastNameTh}
                            </div>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">หัวข้อ</dt>
                          <dd className="mt-1 break-words font-medium">{attempt.presentationSubmission?.titleTh ?? "ยังไม่มีชื่อหัวข้อ"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">สถานะ</dt>
                          <dd className="mt-2">
                            <StatusBadge status={attempt.project.status} />
                          </dd>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg border border-line bg-paperSoft p-3">
                            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">คะแนน</dt>
                            <dd className="mt-2 space-y-1">
                              <div>ส่งแล้ว {summary.submittedCount}</div>
                              <div>ขาด {summary.missingCount}</div>
                              <div>เฉลี่ย {summary.averageScore}</div>
                            </dd>
                          </div>
                          <div className="rounded-lg border border-line bg-paperSoft p-3">
                            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Vote</dt>
                            <dd className="mt-2 space-y-1">
                              <div>PASS {passVotes}</div>
                              <div>REVISE {reviseVotes}</div>
                              <div className={failRatio >= 50 ? "font-semibold text-red-700" : ""}>FAIL {failVotes} ({failRatio}%)</div>
                            </dd>
                          </div>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Final decision</dt>
                          <dd className="mt-1">
                            <div className="font-semibold">{decisionLabel(finalDecision)}</div>
                            {attempt.proposalResult ? (
                              <div className="mt-1 break-words text-xs leading-5 text-muted">
                                decided_by: {attempt.proposalResult.decidedByAdmin.email ?? attempt.proposalResult.decidedByAdmin.name ?? "Admin"}
                                <br />
                                decided_at: {attempt.proposalResult.decidedAt.toLocaleString("th-TH")}
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
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">การทำงาน</div>
                        <form action={saveFinalDecision} className="grid gap-2">
                          <input type="hidden" name="attempt_id" value={attempt.id} />
                          <select name="final_decision" defaultValue={finalDecision ?? "PASS"}>
                            <option value="PASS">PASS - ผ่าน</option>
                            <option value="PASS_WITH_REVISION">PASS_WITH_REVISION - แก้ไข</option>
                            <option value="NOT_PASS">NOT_PASS - ไม่ผ่าน</option>
                          </select>
                          <input name="final_decision_reason" placeholder="เหตุผล/มติที่ประชุม" defaultValue={attempt.proposalResult?.finalDecisionReason ?? ""} />
                          <SubmitButton pendingText="กำลังบันทึกผล..." confirmMessage={decisionConfirm}>
                            {decided ? "บันทึกผลการตัดสินอีกครั้ง" : "บันทึกผลการตัดสิน"}
                          </SubmitButton>
                        </form>
                        <form action={releaseFeedback} className="mt-2">
                          <input type="hidden" name="attempt_id" value={attempt.id} />
                          <SubmitButton disabled={!attempt.proposalResult || Boolean(attempt.scoreRelease)} pendingText="กำลังเปิด feedback...">
                            {attempt.scoreRelease ? "เปิด feedback แล้ว" : "เปิด feedback ให้นักศึกษาเห็น"}
                          </SubmitButton>
                        </form>
                        <details className="mt-3 rounded-md border border-line bg-surface p-2">
                          <summary className="cursor-pointer font-medium">รายละเอียดคะแนน / comment / timeline</summary>
                          <div className="mt-2 space-y-2 text-xs text-muted">
                            {attempt.evaluatorAssignments.map((assignment) => (
                              <div key={assignment.id} className="rounded border border-line p-2">
                                <div className="font-medium text-ink">{assignment.evaluatorDisplayNameSnapshot}</div>
                                <div>status: {assignment.scoreSubmission?.status ?? "ยังไม่ส่ง"}</div>
                                <div>score: {assignment.scoreSubmission ? Number(assignment.scoreSubmission.totalScore) : "-"}</div>
                                <div>comment:</div>
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
                <table className="responsive-table">
                  <thead>
                    <tr className="border-b border-line text-left text-muted">
                      <th className="py-2 pr-3">นักศึกษา</th>
                      <th className="py-2 pr-3">หัวข้อ</th>
                      <th className="py-2 pr-3">สถานะ</th>
                      <th className="py-2 pr-3">คะแนน</th>
                      <th className="py-2 pr-3">Vote</th>
                      <th className="py-2 pr-3">Final decision</th>
                      <th className="py-2 pr-3">การทำงาน</th>
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
                      const decisionConfirm =
                        finalDecision === "NOT_PASS" || finalDecision === "PASS"
                          ? "ยืนยันการบันทึกผลการตัดสินหรือไม่? ระบบจะเปลี่ยนสถานะโครงงานตามผลที่เลือกและบันทึกประวัติไว้"
                          : "ยืนยันการบันทึกผลการตัดสินหรือไม่?";

                      return (
                        <tr key={attempt.id} className="border-b border-line align-top">
                          <td className="py-3 pr-3">
                            <div className="font-medium">
                              {attempt.project.student.studentCode}
                            </div>
                            <div className="text-muted">
                              {attempt.project.student.firstNameTh} {attempt.project.student.lastNameTh}
                            </div>
                          </td>
                          <td className="py-3 pr-3 min-w-56">
                            {attempt.presentationSubmission?.titleTh ?? "ยังไม่มีชื่อหัวข้อ"}
                          </td>
                          <td className="py-3 pr-3">
                            <StatusBadge status={attempt.project.status} />
                          </td>
                          <td className="py-3 pr-3 whitespace-nowrap">
                            <div>ส่งแล้ว {summary.submittedCount}</div>
                            <div>ขาด {summary.missingCount}</div>
                            <div>เฉลี่ย {summary.averageScore}</div>
                          </td>
                          <td className="py-3 pr-3 whitespace-nowrap">
                            <div>PASS {passVotes}</div>
                            <div>REVISE {reviseVotes}</div>
                            <div className={failRatio >= 50 ? "font-semibold text-red-700" : ""}>FAIL {failVotes} ({failRatio}%)</div>
                          </td>
                          <td className="py-3 pr-3 min-w-56">
                            <div className="font-semibold">{decisionLabel(finalDecision)}</div>
                            {attempt.proposalResult ? (
                              <div className="mt-1 text-xs leading-5 text-muted">
                                decided_by: {attempt.proposalResult.decidedByAdmin.email ?? attempt.proposalResult.decidedByAdmin.name ?? "Admin"}
                                <br />
                                decided_at: {attempt.proposalResult.decidedAt.toLocaleString("th-TH")}
                              </div>
                            ) : null}
                            {attempt.proposalResult?.finalDecisionReason ? (
                              <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-xs text-muted" value={attempt.proposalResult.finalDecisionReason} />
                            ) : null}
                            <div className="mt-2 rounded-md border border-line bg-paper p-2 text-xs">{nextDecisionStep(finalDecision)}</div>
                          </td>
                          <td className="py-3 pr-3 min-w-80">
                            <form action={saveFinalDecision} className="grid gap-2">
                              <input type="hidden" name="attempt_id" value={attempt.id} />
                              <select name="final_decision" defaultValue={finalDecision ?? "PASS"}>
                                <option value="PASS">PASS - ผ่าน</option>
                                <option value="PASS_WITH_REVISION">PASS_WITH_REVISION - แก้ไข</option>
                                <option value="NOT_PASS">NOT_PASS - ไม่ผ่าน</option>
                              </select>
                              <input name="final_decision_reason" placeholder="เหตุผล/มติที่ประชุม" defaultValue={attempt.proposalResult?.finalDecisionReason ?? ""} />
                              <SubmitButton pendingText="กำลังบันทึกผล..." confirmMessage={decisionConfirm}>
                                {decided ? "บันทึกผลการตัดสินอีกครั้ง" : "บันทึกผลการตัดสิน"}
                              </SubmitButton>
                            </form>
                            <form action={releaseFeedback} className="mt-2">
                              <input type="hidden" name="attempt_id" value={attempt.id} />
                              <SubmitButton disabled={!attempt.proposalResult || Boolean(attempt.scoreRelease)} pendingText="กำลังเปิด feedback...">
                                {attempt.scoreRelease ? "เปิด feedback แล้ว" : "เปิด feedback ให้นักศึกษาเห็น"}
                              </SubmitButton>
                            </form>
                            <details className="mt-3 rounded-md border border-line p-2">
                              <summary className="cursor-pointer font-medium">รายละเอียดคะแนน / comment / timeline</summary>
                              <div className="mt-2 space-y-2 text-xs text-muted">
                                {attempt.evaluatorAssignments.map((assignment) => (
                                  <div key={assignment.id} className="rounded border border-line p-2">
                                    <div className="font-medium text-ink">{assignment.evaluatorDisplayNameSnapshot}</div>
                                    <div>status: {assignment.scoreSubmission?.status ?? "ยังไม่ส่ง"}</div>
                                    <div>score: {assignment.scoreSubmission ? Number(assignment.scoreSubmission.totalScore) : "-"}</div>
                                    <div>comment:</div>
                                    <MarkdownLatexViewer className="mt-1 border-0 bg-transparent p-0 text-xs" value={assignment.scoreSubmission?.overallComment} emptyText="-" />
                                  </div>
                                ))}
                              </div>
                            </details>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
                </>
              ) : (
                <EmptyState title="ยังไม่มีรายการ Proposal ในรอบนี้" description="เมื่อมีนักศึกษาส่ง Proposal รายการคะแนน Vote และ final decision จะแสดงในรอบนี้" />
              )}
            </section>
          );
        })
      ) : (
        <EmptyState title="ยังไม่มีรอบ Proposal" description="เมื่อสร้างรอบ Proposal แล้ว รายการสรุปผลจะแสดงที่หน้านี้" />
      )}
    </div>
  );
}
