import { auth } from "@/auth";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { prisma } from "@/lib/db";

export default async function StudentFeedbackPage() {
  const session = await auth();
  if (session?.user.role !== "STUDENT" || !session.user.email) return <div className="panel">หน้านี้สำหรับนักศึกษาเท่านั้น</div>;

  const student = await prisma.student.findUnique({
    where: { generatedEmail: session.user.email.toLowerCase() },
    include: {
      projects: {
        include: {
          attempts: {
            include: {
              scoreRelease: true,
              proposalResult: true,
              proposalVotes: { include: { teacher: true }, orderBy: { submittedAt: "asc" } },
              evaluatorAssignments: { include: { scoreSubmission: { include: { proposalDecision: true } } } }
            }
          }
        }
      }
    }
  });
  if (!student) {
    return <div className="panel">ยังไม่พบข้อมูลนักศึกษาใน roster ที่นำเข้า</div>;
  }

  const attempt = student?.projects[0]?.attempts.find((item) => item.attemptType === "MAIN_PROPOSAL");

  if (!attempt) {
    return <div className="panel">ยังไม่มี feedback Proposal</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">ผลและ feedback Proposal</h1>
      <section className="panel">
        <h2 className="font-semibold">ผลตัดสินสุดท้าย</h2>
        <p className="mt-2">{attempt.proposalResult?.finalDecision ?? "รอ Admin ตัดสินผล"}</p>
        {attempt.proposalResult?.finalDecisionReason ? (
          <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-sm text-muted" value={attempt.proposalResult.finalDecisionReason} />
        ) : null}
        <p className="mt-2 text-sm text-muted">Lifecycle v2: นักศึกษาเห็น comment ทันที แต่ไม่เห็นคะแนน Proposal</p>
      </section>
      <section className="panel">
        <h2 className="font-semibold">ข้อเสนอแนะจากกรรมการ Proposal</h2>
        <div className="mt-3 space-y-3">
          {attempt.proposalVotes.length ? (
            attempt.proposalVotes.map((vote) => (
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
            attempt.evaluatorAssignments
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
    </div>
  );
}
