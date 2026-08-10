import Link from "next/link";
import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { InfoAlert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TeacherCompactQueueList, TeacherQueueBadge, TeacherQueueSection, TeacherWorkloadSummary } from "@/components/ui/TeacherWorkloadQueue";
import { prisma } from "@/lib/db";
import { openProposalScoringAttemptWhere } from "@/lib/scoring/proposalWorkload";
import { openProposalScoring } from "../actions";

export default async function TeacherProposalsPage() {
  const session = await auth();
  if (!hasApprovedTeacherCapability(session?.user) || !session?.user.id) return <div className="panel">หน้านี้สำหรับอาจารย์เท่านั้น</div>;

  const attempts = await prisma.assessmentAttempt.findMany({
    where: openProposalScoringAttemptWhere(),
    include: {
      presentationSubmission: true,
      project: { include: { student: true } },
      evaluatorAssignments: { where: { evaluatorUserId: session.user.id }, include: { scoreSubmission: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  const pendingAttempts = attempts.filter((attempt) => attempt.evaluatorAssignments[0]?.scoreSubmission?.status !== "SUBMITTED");
  const completedAttempts = attempts.filter((attempt) => attempt.evaluatorAssignments[0]?.scoreSubmission?.status === "SUBMITTED");

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
              {submitted ? "แก้ไขคะแนนที่ส่งแล้ว" : "ประเมินการเสนอหัวข้อ"}
            </Link>
          ) : (
            <form action={openProposalScoring}>
              <input type="hidden" name="attempt_id" value={attempt.id} />
              <SubmitButton pendingText="กำลังเปิดแบบประเมิน...">เริ่มประเมิน</SubmitButton>
            </form>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="ประเมินการเสนอหัวข้อ" description="อ่านบทคัดย่อและเอกสารแนบก่อนประเมินตามเกณฑ์" />
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
