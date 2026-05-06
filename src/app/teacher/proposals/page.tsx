import { auth } from "@/auth";
import { InfoAlert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/db";
import { openProposalScoring } from "../actions";

export default async function TeacherProposalsPage() {
  const session = await auth();
  if (session?.user.role !== "TEACHER" || !session.user.id) return <div className="panel">หน้านี้สำหรับอาจารย์เท่านั้น</div>;

  const attempts = await prisma.assessmentAttempt.findMany({
    where: { assessmentRound: { roundType: "PROPOSAL" }, presentationSubmission: { status: { in: ["SUBMITTED", "LOCKED"] } } },
    include: {
      presentationSubmission: true,
      project: { include: { student: true } },
      evaluatorAssignments: { where: { evaluatorUserId: session.user.id }, include: { scoreSubmission: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <PageHeader title="ประเมิน Proposal" description="อ่าน abstract และเอกสารแนบก่อนประเมินด้วย checklist" />
      <GuidancePanel
        title="แนวทางประเมิน"
        current="ตรวจเอกสารแนบและให้คะแนนตาม checklist Proposal"
        next="นักศึกษาจะเห็น comment และชื่ออาจารย์ทันที แต่ไม่เห็นคะแนน Proposal"
        actor="อาจารย์ภายในที่ประเมิน Proposal"
      />
      <InfoAlert title="ข้อควรระวัง">
        การเลือก REVISE หรือ FAIL ควรระบุเหตุผลชัดเจนเพื่อให้นักศึกษาแก้ไขได้ตรงจุด
      </InfoAlert>
      <div className="space-y-3">
        {attempts.length ? attempts.map((attempt) => {
          const assignment = attempt.evaluatorAssignments[0];
          const submitted = assignment?.scoreSubmission?.status === "SUBMITTED";
          return (
            <section key={attempt.id} className="panel flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">{attempt.presentationSubmission?.titleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
                <p className="mt-1 text-sm text-muted">
                  {attempt.project.student.studentCode} {attempt.project.student.firstNameTh} {attempt.project.student.lastNameTh}
                </p>
                {attempt.presentationSubmission?.materialLink ? (
                  <a className="mt-2 inline-block text-sm text-brand" href={attempt.presentationSubmission.materialLink} target="_blank" rel="noreferrer">เปิดเอกสารแนบ</a>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="rounded-full border border-line px-3 py-1 text-xs">{submitted ? "ประเมินแล้ว" : "รอประเมิน"}</span>
                {assignment ? (
                  <a className="button" href={`/teacher/scoring/${assignment.id}`}>ประเมิน Proposal</a>
                ) : (
                  <form action={openProposalScoring}>
                    <input type="hidden" name="attempt_id" value={attempt.id} />
                    <button type="submit">เริ่มประเมิน</button>
                  </form>
                )}
              </div>
            </section>
          );
        }) : (
          <EmptyState title="ยังไม่มี Proposal ที่ส่งแล้ว" description="เมื่อนักศึกษาส่ง Proposal รายการจะปรากฏที่นี่" />
        )}
      </div>
    </div>
  );
}
