import Link from "next/link";
import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { InfoAlert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeacherCompactQueueList, TeacherQueueBadge, TeacherQueueSection, TeacherWorkloadSummary } from "@/components/ui/TeacherWorkloadQueue";
import { FigmaMetricCard, FigmaPageHeader, FigmaPanel, FigmaReviewLayout, FigmaStatusBadge } from "@/components/redesign/VisualSurfaces";
import { prisma } from "@/lib/db";
import { LATE_ROUND_EXCEPTION_TYPE, LATE_ROUND_EXCUSED_EXCEPTION_TYPE } from "@/lib/assessments/roundExceptions";
import { getUiMode } from "@/lib/uiMode";
import { openProposalScoring } from "../actions";

export default async function TeacherProposalsPage() {
  const session = await auth();
  if (!hasApprovedTeacherCapability(session?.user) || !session?.user.id) return <div className="panel">หน้านี้สำหรับอาจารย์เท่านั้น</div>;

  const attempts = await prisma.assessmentAttempt.findMany({
    where: {
      presentationSubmission: { status: { in: ["SUBMITTED", "LOCKED"] } },
      proposalResult: { is: null },
      OR: [
        { assessmentRound: { roundType: "PROPOSAL", status: "SCORING_OPEN" } },
        {
          assessmentRound: { roundType: "PROPOSAL" },
          project: {
            roundExceptions: {
              some: {
                status: "OPEN",
                exceptionType: { in: [LATE_ROUND_EXCEPTION_TYPE, LATE_ROUND_EXCUSED_EXCEPTION_TYPE] },
                assessmentRound: { roundType: "PROPOSAL" }
              }
            }
          }
        }
      ]
    },
    include: {
      presentationSubmission: true,
      project: { include: { student: true } },
      evaluatorAssignments: { where: { evaluatorUserId: session.user.id }, include: { scoreSubmission: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  const pendingAttempts = attempts.filter((attempt) => attempt.evaluatorAssignments[0]?.scoreSubmission?.status !== "SUBMITTED");
  const completedAttempts = attempts.filter((attempt) => attempt.evaluatorAssignments[0]?.scoreSubmission?.status === "SUBMITTED");
  const uiMode = await getUiMode();

  const renderAttempt = (attempt: (typeof attempts)[number], submitted: boolean) => {
    const assignment = attempt.evaluatorAssignments[0];
    return (
      <section key={attempt.id} id={`proposal-${attempt.id}`} className="panel teacher-review-card scroll-mt-24 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">{attempt.presentationSubmission?.titleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
          <p className="mt-1 text-sm text-muted">
            {attempt.project.student.studentCode} {attempt.project.student.firstNameTh} {attempt.project.student.lastNameTh}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <TeacherQueueBadge tone={submitted ? "completed" : "action"}>{submitted ? "ประเมินแล้ว" : "รอประเมิน"}</TeacherQueueBadge>
            <TeacherQueueBadge tone="waiting">Proposal</TeacherQueueBadge>
          </div>
          {attempt.presentationSubmission?.materialLink ? (
            <a className="mt-2 inline-block text-sm text-brand" href={attempt.presentationSubmission.materialLink} target="_blank" rel="noreferrer">เปิดเอกสารแนบ</a>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {assignment ? (
            <Link className={submitted ? "button-secondary" : "button"} href={`/teacher/scoring/${assignment.id}`}>
              {submitted ? "ดูผลประเมินที่ส่งแล้ว" : "ประเมินการเสนอหัวข้อ"}
            </Link>
          ) : (
            <form action={openProposalScoring}>
              <input type="hidden" name="attempt_id" value={attempt.id} />
              <button type="submit">เริ่มประเมิน</button>
            </form>
          )}
        </div>
      </section>
    );
  };

  const renderFigmaAttempt = (attempt: (typeof attempts)[number], submitted: boolean) => {
    const assignment = attempt.evaluatorAssignments[0];
    const statusLabel = submitted ? "ประเมินแล้ว" : "รอประเมิน";
    return (
      <section key={`${attempt.id}-figma`} id={`proposal-${attempt.id}`} className="scroll-mt-24 rounded-lg border border-line bg-surface p-4 shadow-sm">
        <FigmaReviewLayout
          context={
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap gap-2">
                  <FigmaStatusBadge tone={submitted ? "success" : "action"}>{statusLabel}</FigmaStatusBadge>
                  <FigmaStatusBadge tone="muted">Proposal</FigmaStatusBadge>
                </div>
                <h2 className="mt-3 text-lg font-semibold text-ink">{attempt.presentationSubmission?.titleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {attempt.project.student.studentCode} {attempt.project.student.firstNameTh} {attempt.project.student.lastNameTh}
                </p>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-ink">รอบ</dt>
                  <dd className="text-muted">Proposal</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink">สถานะ</dt>
                  <dd className="text-muted">{statusLabel}</dd>
                </div>
              </dl>
              {attempt.presentationSubmission?.materialLink ? (
                <a className="inline-flex text-sm font-semibold text-brand hover:underline" href={attempt.presentationSubmission.materialLink} target="_blank" rel="noreferrer">
                  เปิดเอกสารแนบ
                </a>
              ) : (
                <p className="text-sm text-muted">ยังไม่พบเอกสารแนบ</p>
              )}
            </div>
          }
          action={
            <div className="rounded-lg border border-line bg-paperSoft p-4">
              <h3 className="text-sm font-semibold text-ink">{submitted ? "ดูผลประเมิน" : "ดำเนินการประเมิน"}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                {submitted
                  ? "รายการนี้ส่งคะแนนแล้ว และแยกไว้เป็นงานอ่านย้อนหลัง"
                  : "เปิดฟอร์มประเมินด้วย action เดิม โดยไม่เปลี่ยนสิทธิ์หรือขั้นตอน"}
              </p>
              <div className="mt-4">
                {assignment ? (
                  <Link className={submitted ? "button-secondary" : "button"} href={`/teacher/scoring/${assignment.id}`}>
                    {submitted ? "ดูผลประเมินที่ส่งแล้ว" : "ประเมินการเสนอหัวข้อ"}
                  </Link>
                ) : (
                  <form action={openProposalScoring}>
                    <input type="hidden" name="attempt_id" value={attempt.id} />
                    <button type="submit">เริ่มประเมิน</button>
                  </form>
                )}
              </div>
            </div>
          }
        />
      </section>
    );
  };

  if (uiMode === "figma") {
    return (
      <div className="figma-dashboard-page figma-teacher-proposals">
        <FigmaPageHeader
          eyebrow="Proposal"
          title="ประเมินการเสนอหัวข้อ"
          description="อ่านบทคัดย่อและเอกสารแนบก่อนประเมินตามเกณฑ์"
        />

        <div className="figma-kpi-grid">
          <FigmaMetricCard label="ต้องดำเนินการ" value={pendingAttempts.length} description="ยังไม่ได้ส่งคะแนน Proposal" tone="action" />
          <FigmaMetricCard label="รอ" value={0} description="ไม่มีสถานะรอในหน้านี้" tone="warning" />
          <FigmaMetricCard label="เสร็จแล้ว" value={completedAttempts.length} description="ส่งคะแนนแล้ว ดูย้อนหลังได้" tone="success" />
          <FigmaMetricCard label="รายการทั้งหมด" value={attempts.length} description="รวม Proposal ในขอบเขตการประเมินของท่าน" tone="muted" />
          <FigmaMetricCard label="ยังไม่เปิด" value={0} description="รายการที่ไม่เกี่ยวข้องไม่แสดง" tone="muted" />
        </div>

        <div className="figma-dashboard-grid">
          <FigmaPanel
            title="คิว Proposal ที่ต้องประเมิน"
            description="รายการที่อาจารย์ยังไม่ได้ส่งคะแนน แยกไว้ก่อนงานอ่านย้อนหลัง"
            tone="action"
          >
            {pendingAttempts.length ? (
              <div className="figma-action-list">
                {pendingAttempts.map((attempt) => (
                  <a key={`${attempt.id}-figma-queue`} className="figma-action-row figma-proposal-row" data-tone="action" href={`#proposal-${attempt.id}`}>
                    <div>
                      <strong>{attempt.presentationSubmission?.titleTh ?? "ยังไม่มีชื่อหัวข้อ"}</strong>
                      <p>
                        {attempt.project.student.studentCode} {attempt.project.student.firstNameTh} {attempt.project.student.lastNameTh}
                      </p>
                      <small>Proposal</small>
                    </div>
                    <FigmaStatusBadge tone="action">รอประเมิน</FigmaStatusBadge>
                  </a>
                ))}
              </div>
            ) : (
              <EmptyState title="ไม่มี Proposal ที่ต้องประเมินตอนนี้" description="รายการที่ส่งคะแนนแล้วถูกแยกไปอยู่ในส่วนเสร็จแล้ว" />
            )}
          </FigmaPanel>

          <FigmaPanel
            title="เสร็จแล้ว / อ่านย้อนหลัง"
            description="รายการที่ส่งคะแนนแล้วไม่ปนกับงานที่ต้องทำ"
            tone="success"
          >
            {completedAttempts.length ? (
              <div className="figma-action-list">
                {completedAttempts.slice(0, 8).map((attempt) => (
                  <a key={`${attempt.id}-figma-completed`} className="figma-action-row figma-proposal-row" data-tone="success" href={`#proposal-${attempt.id}`}>
                    <div>
                      <strong>{attempt.presentationSubmission?.titleTh ?? "ยังไม่มีชื่อหัวข้อ"}</strong>
                      <p>
                        {attempt.project.student.studentCode} {attempt.project.student.firstNameTh} {attempt.project.student.lastNameTh}
                      </p>
                    </div>
                    <FigmaStatusBadge tone="success">ประเมินแล้ว</FigmaStatusBadge>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">ยังไม่มี Proposal ที่ประเมินเสร็จ</p>
            )}
          </FigmaPanel>
        </div>

        <FigmaPanel
          title="รายละเอียดงานประเมิน"
          description="ส่วนนี้ใช้ action/link เดิมทั้งหมด เปลี่ยนเฉพาะ layout ให้ใกล้ Project Review Detail"
          tone={pendingAttempts.length ? "action" : "muted"}
        >
          {attempts.length ? (
            <div className="space-y-4">
              {pendingAttempts.map((attempt) => renderFigmaAttempt(attempt, false))}
              {completedAttempts.map((attempt) => renderFigmaAttempt(attempt, true))}
            </div>
          ) : (
            <EmptyState title="ยังไม่มีเอกสารเสนอหัวข้อที่ส่งแล้ว" description="เมื่อนักศึกษาส่งเอกสารเสนอหัวข้อ รายการจะปรากฏที่นี่" />
          )}
        </FigmaPanel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="ประเมินการเสนอหัวข้อ" description="อ่านบทคัดย่อและเอกสารแนบก่อนประเมินตามเกณฑ์" />
      <GuidancePanel
        title="แนวทางประเมิน"
        current="ตรวจเอกสารแนบและให้คะแนนตามเกณฑ์การเสนอหัวข้อ"
        next="นักศึกษาจะเห็นข้อเสนอแนะและชื่ออาจารย์ทันที แต่ไม่เห็นคะแนนการเสนอหัวข้อ"
        actor="อาจารย์ภายในที่ประเมินการเสนอหัวข้อ"
      />
      <InfoAlert title="ข้อควรระวัง">
        การเลือก REVISE หรือ FAIL ควรระบุเหตุผลชัดเจนเพื่อให้นักศึกษาแก้ไขได้ตรงจุด
      </InfoAlert>
      <TeacherWorkloadSummary
        metrics={[
          { label: "ต้องดำเนินการ", count: pendingAttempts.length, tone: "action", description: "ยังไม่ได้ส่งคะแนน Proposal" },
          { label: "รอ", count: 0, tone: "waiting", description: "ไม่มีสถานะรอในหน้านี้" },
          { label: "เสร็จแล้ว", count: completedAttempts.length, tone: "completed", description: "ส่งคะแนนแล้ว ดูย้อนหลังได้" },
          { label: "ส่งกลับ", count: 0, tone: "returned", description: "ไม่ใช้กับ Proposal scoring" },
          { label: "ยังไม่เปิด", count: 0, tone: "locked", description: "รายการที่ไม่เกี่ยวข้องไม่แสดง" }
        ]}
      />
      {!attempts.length ? (
        <EmptyState title="ยังไม่มีเอกสารเสนอหัวข้อที่ส่งแล้ว" description="เมื่อนักศึกษาส่งเอกสารเสนอหัวข้อ รายการจะปรากฏที่นี่" />
      ) : (
        <div className="space-y-4">
          <TeacherQueueSection
            title="ต้องดำเนินการ"
            description="รายการที่อาจารย์ยังไม่ได้ส่งคะแนน"
            count={pendingAttempts.length}
            tone="action"
            emptyState={<EmptyState title="ไม่มี Proposal ที่ต้องประเมินตอนนี้" description="รายการที่ส่งคะแนนแล้วถูกแยกไปอยู่ในส่วนเสร็จแล้ว" />}
          >
            <div className="space-y-3">
              <TeacherCompactQueueList
                items={pendingAttempts.map((attempt) => ({
                  id: attempt.id,
                  href: `#proposal-${attempt.id}`,
                  title: attempt.presentationSubmission?.titleTh ?? "ยังไม่มีชื่อหัวข้อ",
                  description: `${attempt.project.student.studentCode} ${attempt.project.student.firstNameTh} ${attempt.project.student.lastNameTh}`,
                  meta: "Proposal",
                  badges: [
                    { label: "รอประเมิน", tone: "action" },
                    { label: "Proposal", tone: "waiting" }
                  ]
                }))}
              />
              {pendingAttempts.map((attempt) => renderAttempt(attempt, false))}
            </div>
          </TeacherQueueSection>
          <TeacherQueueSection
            title="เสร็จแล้ว / อ่านย้อนหลัง"
            description="รายการที่ส่งคะแนนแล้วไม่ปนกับงานที่ต้องทำ"
            count={completedAttempts.length}
            tone="completed"
            emptyState={<EmptyState title="ยังไม่มี Proposal ที่ประเมินเสร็จ" description="เมื่อส่งคะแนนแล้ว รายการจะย้ายมาที่ส่วนนี้" />}
          >
            <div className="space-y-3">{completedAttempts.map((attempt) => renderAttempt(attempt, true))}</div>
          </TeacherQueueSection>
        </div>
      )}
    </div>
  );
}
