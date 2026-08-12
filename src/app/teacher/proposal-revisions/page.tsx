import { auth } from "@/auth";
import { reviewProposalRevision } from "@/app/teacher/actions";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProposalLifecycleActionForm } from "@/components/ui/ProposalLifecycleActionForm";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { prisma } from "@/lib/db";

export default async function TeacherProposalRevisionsPage() {
  const session = await auth();
  if (!hasApprovedTeacherCapability(session?.user) || !session?.user.id) {
    return <div className="panel">หน้านี้สำหรับอาจารย์ที่อนุมัติแล้วเท่านั้น</div>;
  }

  const teacher = await prisma.teacher.findUnique({
    where: session.user.teacherId ? { id: session.user.teacherId } : { userId: session.user.id },
    select: { id: true }
  });
  if (!teacher) {
    return <EmptyState title="ยังไม่พบโปรไฟล์อาจารย์" description="กรุณาติดต่อผู้ดูแลระบบเพื่อตรวจสอบการผูกบัญชีอาจารย์" />;
  }

  const candidates = await prisma.project.findMany({
    where: {
      status: "PROPOSAL_REVISION_REQUIRED",
      proposalResults: { some: { finalDecision: "PASS_WITH_REVISION" } },
      advisorRequests: { some: { advisorTeacherId: teacher.id, status: "APPROVED" } }
    },
    include: {
      student: true,
      advisorRequests: { orderBy: { requestedAt: "desc" }, take: 1 },
      proposalResults: { orderBy: { decidedAt: "desc" }, take: 1 },
      presentationSubmissions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: { versions: { orderBy: { versionNo: "desc" } } }
      }
    },
    orderBy: { updatedAt: "desc" }
  });
  const projects = candidates.filter((project) => {
    const latestAdvisorRequest = project.advisorRequests[0];
    return latestAdvisorRequest?.status === "APPROVED" && latestAdvisorRequest.advisorTeacherId === teacher.id;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="ตรวจ Proposal ฉบับแก้ไข"
        description="ตรวจการแก้ไขตามมติผ่านโดยให้แก้ไข ขั้นตอนนี้ไม่ใช่การสอบหรือให้คะแนนใหม่"
      />
      <div className="space-y-4">
        {projects.length ? projects.map((project) => {
          const submission = project.presentationSubmissions[0];
          const result = project.proposalResults[0];
          const waitingForStudent = submission?.status === "RETURNED_FOR_REVISION";
          const readyForReview = submission?.status === "SUBMITTED";
          return (
            <section key={project.id} className="panel space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{submission?.titleTh ?? project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}
                  </p>
                </div>
                <StatusBadge
                  status={project.status}
                  label={submission?.status === "SUBMITTED" ? "รอที่ปรึกษาตรวจ" : "รอนักศึกษาแก้ไข"}
                />
              </div>

              {result?.finalDecisionReason ? (
                <div className="rounded-md border border-line bg-paper p-3 text-sm">
                  <div className="font-medium">เหตุผลประกอบมติ</div>
                  <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-muted" value={result.finalDecisionReason} />
                </div>
              ) : null}

              {submission ? (
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <div className="rounded-md border border-line bg-paper p-3 md:col-span-2">
                    <div className="font-medium">Proposal ฉบับที่ {submission.versions[0]?.versionNo ?? 1}</div>
                    <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-muted" value={submission.abstractText} />
                  </div>
                  <a className="text-brand underline md:col-span-2" href={submission.materialLink} target="_blank" rel="noreferrer">
                    เปิดเอกสารประกอบ
                  </a>
                </div>
              ) : null}

              {readyForReview && submission ? (
                <ProposalLifecycleActionForm action={reviewProposalRevision} className="space-y-3">
                  <input type="hidden" name="project_id" value={project.id} />
                  <input type="hidden" name="submission_id" value={submission.id} />
                  <div>
                    <label htmlFor={`revision-comment-${project.id}`}>เหตุผลเมื่อส่งกลับให้แก้เพิ่มเติม</label>
                    <textarea id={`revision-comment-${project.id}`} name="comment" rows={4} />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <SubmitButton
                      name="decision"
                      value="APPROVE"
                      pendingText="กำลังรับรองการแก้ไข..."
                      confirmMessage="ยืนยันว่าการแก้ไข Proposal ครบถ้วนและพร้อมเข้าสู่ขั้นแต่งตั้งกรรมการหรือไม่?"
                      autoRecovery={false}
                    >
                      รับรองการแก้ไข
                    </SubmitButton>
                    <SubmitButton
                      name="decision"
                      value="RETURN"
                      className="button-secondary"
                      pendingText="กำลังส่งกลับ..."
                      confirmMessage="ยืนยันการส่งกลับให้นักศึกษาแก้ไขเพิ่มเติมหรือไม่?"
                      autoRecovery={false}
                    >
                      ส่งกลับให้แก้เพิ่มเติม
                    </SubmitButton>
                  </div>
                </ProposalLifecycleActionForm>
              ) : waitingForStudent ? (
                <p className="rounded-md border border-line bg-paper p-3 text-sm text-muted">ส่งกลับแล้ว กำลังรอนักศึกษาส่งฉบับแก้ไขครั้งถัดไป</p>
              ) : (
                <p className="rounded-md border border-line bg-paper p-3 text-sm text-muted">เอกสารยังไม่อยู่ในสถานะพร้อมตรวจ กรุณาตรวจสอบสถานะล่าสุด</p>
              )}
            </section>
          );
        }) : (
          <EmptyState title="ยังไม่มี Proposal ฉบับแก้ไขที่ต้องตรวจ" description="รายการจะแสดงเมื่อนักศึกษาที่ท่านเป็นที่ปรึกษาส่งฉบับแก้ไขตามมติแล้ว" />
        )}
      </div>
    </div>
  );
}
