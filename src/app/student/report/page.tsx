import { auth } from "@/auth";
import { submitReportVersion } from "@/app/student/actions";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { InfoAlert, SuccessAlert, WarningAlert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormSection } from "@/components/ui/FormSection";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { MaterialLinkField } from "@/components/ui/MaterialLinkField";
import { PageHeader } from "@/components/ui/PageHeader";
import { DraftPreservingForm } from "@/components/ui/ProposalDraftForm";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
import { isPresentationAssessmentComplete } from "@/lib/assessments/presentationCompletion";
import { getReportSubmissionGate, reportSubmissionReasonLabel } from "@/lib/reports/reportWorkflow";
import { teacherDisplayName } from "@/lib/teachers/displayName";

export default async function StudentReportPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user.role !== "STUDENT" || !session.user.email) {
    return <div className="panel">หน้านี้สำหรับนักศึกษาเท่านั้น</div>;
  }

  const params = (await searchParams) ?? {};
  const student = await prisma.student.findUnique({
    where: { generatedEmail: session.user.email.toLowerCase() },
    include: {
      projects: {
        orderBy: { createdAt: "desc" },
        include: {
          courseOffering: {
            select: {
              assessmentRounds: { where: { roundType: "FINAL_PRESENTATION" }, select: { status: true }, take: 1 }
            }
          },
          committeeAssignments: { select: { teacherId: true, role: true, active: true } },
          attempts: {
            where: { attemptType: "FINAL_PRESENTATION" },
            select: {
              evaluatorAssignments: {
                select: {
                  teacherId: true,
                  scoreSubmission: { select: { status: true } }
                }
              }
            }
          },
          reportVersions: {
            include: { reviews: { include: { reviewerTeacher: true }, orderBy: { reviewedAt: "desc" } } },
            orderBy: { versionNo: "desc" }
          },
          timelineEvents: {
            where: { eventType: "REPORT_VERSION_SUBMITTED" },
            orderBy: { occurredAt: "desc" }
          }
        }
      }
    }
  });
  if (!student) {
    return <EmptyState title="ยังไม่พบข้อมูลนักศึกษา" description="บัญชีนี้ยังไม่อยู่ใน roster ที่นำเข้า กรุณาติดต่อผู้ดูแลระบบ" />;
  }

  const project = student.projects[0];
  if (!project) {
    return <EmptyState title="ยังไม่มีโปรเจค" description="ยังไม่พบโปรเจคสำหรับส่งเล่มรายงาน" />;
  }

  const latestReport = project.reportVersions[0];
  const finalPresentationCompleted = project.status === "IN_PROGRESS"
    ? isPresentationAssessmentComplete({
        roundStatus: project.courseOffering.assessmentRounds[0]?.status,
        committeeAssignments: project.committeeAssignments,
        scoreSubmissions: project.attempts.flatMap((attempt) =>
          attempt.evaluatorAssignments.map((assignment) => ({
            teacherId: assignment.teacherId,
            status: assignment.scoreSubmission?.status ?? null
          }))
        )
      })
    : false;
  const gate = getReportSubmissionGate({
    projectStatus: project.status,
    latestReportHasRevisionRequest: Boolean(latestReport?.reviews.some((review) => review.decision === "FAIL")),
    finalPresentationCompleted
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="ส่งเล่มรายงาน"
        description="ส่งลิงก์เล่มรายงานและติดตามผลตรวจ PASS / ขอแก้ไขจากอาจารย์"
        actions={<StatusBadge status={project.status} />}
      />
      <ActionFeedback success={params.success} error={params.error} />
      <GuidancePanel
        title="Report approval loop"
        current={reportSubmissionReasonLabel(gate.reason)}
        next="ถ้าอาจารย์ขอแก้ไข นักศึกษาจะส่ง version ใหม่ได้จากหน้านี้"
        actor="นักศึกษาและอาจารย์ผู้ตรวจเล่ม"
      />
      {project.status === "REPORT_APPROVED" ? (
        <SuccessAlert title="เล่มรายงานผ่านแล้ว">ระบบหยุดที่สถานะ REPORT_APPROVED และยังไม่เข้าสู่ Advisor scoring ในขั้นตอนนี้</SuccessAlert>
      ) : null}
      {!gate.allowed && project.status !== "REPORT_APPROVED" ? (
        <WarningAlert title="ยังส่งเล่มไม่ได้">{reportSubmissionReasonLabel(gate.reason)}</WarningAlert>
      ) : null}
      <InfoAlert title="รูปแบบลิงก์">ใช้ลิงก์ Google Drive, Google Docs หรือ Google Classroom เท่านั้น และ comment รองรับ Markdown/LaTeX</InfoAlert>
      {(
        <div className="space-y-4">
          <section className="panel">
            <h2 className="text-lg font-semibold">Report evidence guidance</h2>
            <div className="mt-3 grid gap-3 text-sm text-muted md:grid-cols-2">
              <p>รายงานควรมี abstract, background, objectives, methods, results, conclusion และ references ครบถ้วน</p>
              <p>วัตถุประสงค์ วิธีดำเนินงาน และผลลัพธ์ในรายงานควรสอดคล้องกันและตรวจสอบย้อนกลับไปยัง Proposal ได้</p>
              <p>ผลลัพธ์หรือข้อสรุปควรมีหลักฐานรองรับ เช่น proof, analysis, implementation, experiment result หรือ artifact ที่ตรวจได้</p>
              <p>สมการ รูปภาพ ตาราง และเอกสารอ้างอิงควรมีรูปแบบสม่ำเสมอเพื่อใช้เป็นหลักฐาน QA/AUN-QA</p>
            </div>
          </section>
        </div>
      )}

      <FormSection title="ส่งเล่มรายงาน version ใหม่" description={reportSubmissionReasonLabel(gate.reason)}>
        <DraftPreservingForm action={submitReportVersion} storageKey={`student-report-draft:${project.id}`} clearOnSuccess={params.success === "report_submitted"} className="space-y-4">
          <MaterialLinkField name="report_drive_link" />
          <MarkdownLatexEditor
            name="report_note"
            label="สรุปการแก้ไข / ตอบกลับ comment ผู้ตรวจ"
            required={false}
            rows={4}
            placeholder={`ตัวอย่างการตอบกลับ comment ผู้ตรวจ

ข้อเสนอแนะที่ 1: ระบุข้อเสนอแนะของผู้ตรวจ
การแก้ไขที่ดำเนินการ: แก้ไขตามข้อเสนอแนะโดยปรับนิยาม/คำอธิบายในหัวข้อ ...
ตำแหน่งที่แก้ไขในเล่ม: บทที่ ... หน้า ... หัวข้อ ...
หลักฐานหรือเหตุผลประกอบ: เพิ่มตาราง/รูป/การพิสูจน์/ผลการทดลอง ... แล้ว

ข้อเสนอแนะที่ 2: ...
การแก้ไขที่ดำเนินการ: ...
ตำแหน่งที่แก้ไขในเล่ม: ...
หมายเหตุ: หากไม่ได้แก้ตามข้อเสนอแนะ ให้ระบุเหตุผลเชิงวิชาการอย่างชัดเจน`}
            disabled={!gate.allowed}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" data-draft-save className="button-secondary w-full sm:w-auto">
              บันทึกไว้ก่อน
            </button>
            <SubmitButton disabled={!gate.allowed} pendingText="กำลังส่งเล่มรายงาน..." confirmMessage="ยืนยันการส่งเล่มรายงาน version นี้หรือไม่?" className="w-full sm:w-auto">
              ส่งเล่มรายงาน version ใหม่
            </SubmitButton>
          </div>
        </DraftPreservingForm>
      </FormSection>

      <section className="panel">
        <h2 className="text-lg font-semibold">ประวัติ version รายงาน</h2>
        <div className="mt-3 space-y-3">
          {project.reportVersions.length ? (
            project.reportVersions.map((version) => {
              const noteEvent = project.timelineEvents.find((event) => event.relatedEntityId === version.id);
              return (
                <div key={version.id} className="rounded-md border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">Version {version.versionNo}</div>
                    <span className="text-xs text-muted">{version.submittedAt.toLocaleString("th-TH")}</span>
                  </div>
                  <a className="mt-1 inline-block text-brand" href={version.driveLink} target="_blank" rel="noreferrer">
                    เปิดลิงก์รายงาน
                  </a>
                  {noteEvent?.eventDescription ? (
                    <MarkdownLatexViewer className="mt-3 border-0 bg-paper p-3 text-muted" value={noteEvent.eventDescription} />
                  ) : null}
                  <div className="mt-3 space-y-2">
                    {version.reviews.length ? (
                      version.reviews.map((review) => (
                        <div key={review.id} className="rounded-md bg-paper p-2">
                          <span className="font-medium">{teacherDisplayName(review.reviewerTeacher)}</span>
                          <span className="ml-2">{review.decision === "PASS" ? "PASS" : "ขอแก้ไข"}</span>
                          {review.comment ? <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-muted" value={review.comment} /> : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted">ยังไม่มีผลตรวจ</p>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState title="ยังไม่มี version รายงาน" description="หลังสอบ Final เสร็จและสถานะเป็น FINAL_DONE นักศึกษาจะเริ่มส่งเล่มรายงานได้" />
          )}
        </div>
      </section>
    </div>
  );
}
