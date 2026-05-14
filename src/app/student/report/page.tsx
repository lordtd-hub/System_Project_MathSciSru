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
import { StudentReadabilitySummary } from "@/components/ui/StudentReadabilitySummary";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
import { formatThaiDateTime24 } from "@/lib/format/dateTime";
import { isPresentationAssessmentComplete } from "@/lib/assessments/presentationCompletion";
import { getReportSubmissionGate, getStudentReportActionLabel, reportSubmissionReasonLabel } from "@/lib/reports/reportWorkflow";
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
    return <EmptyState title="ยังไม่มีโครงงาน" description="ยังไม่พบโครงงานสำหรับส่งรายงานฉบับสมบูรณ์" />;
  }

  const latestReport = project.reportVersions[0];
  const latestReportHasRevisionRequest = Boolean(latestReport?.reviews.some((review) => review.decision === "FAIL"));
  const reportActionLabel = getStudentReportActionLabel({
    hasReportVersion: Boolean(latestReport),
    latestReportHasRevisionRequest,
    projectStatus: project.status
  });
  const reportHistory = [...project.reportVersions].sort((a, b) => a.versionNo - b.versionNo);
  const finalPresentationCompleted = project.status === "IN_PROGRESS"
    ? isPresentationAssessmentComplete({
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
    latestReportHasRevisionRequest,
    finalPresentationCompleted
  });
  const waitingForReview = Boolean(latestReport && !latestReportHasRevisionRequest && project.status === "REPORT_REVIEW");

  return (
    <div className="space-y-6">
      <PageHeader
        title="ส่งเล่มรายงาน"
        description="ส่งลิงก์รายงานฉบับสมบูรณ์และติดตามผลการตรวจจากอาจารย์ผู้ตรวจ"
        actions={<StatusBadge status={project.status} />}
      />
      <ActionFeedback success={params.success} error={params.error} />
      <GuidancePanel
        title="ขั้นตอนการตรวจรายงาน"
        current={reportSubmissionReasonLabel(gate.reason)}
        next="หากผู้ตรวจขอให้แก้ไข นักศึกษาสามารถส่งรายงานฉบับใหม่จากหน้านี้"
        actor="นักศึกษาและอาจารย์ผู้ตรวจเล่ม"
      />
      <StudentReadabilitySummary
        title="สรุปสถานะรายงาน"
        description="หน้านี้แยกงานที่นักศึกษาต้องทำออกจากสถานะที่รอผู้ตรวจ เพื่อไม่ให้เข้าใจว่าต้องส่งซ้ำระหว่างรอผล"
        items={[
          {
            label: "ต้องทำตอนนี้",
            value: gate.allowed ? 1 : 0,
            detail: latestReportHasRevisionRequest ? "ผู้ตรวจขอแก้ไข ส่งฉบับใหม่พร้อมสรุปการแก้ไข" : "ส่งเล่มรายงานเมื่อระบบเปิดให้ส่ง",
            tone: gate.allowed ? "action" : "locked"
          },
          {
            label: "รอผู้ตรวจ",
            value: waitingForReview ? 1 : 0,
            detail: "มีรายงานที่ส่งแล้วและยังไม่ต้องส่งซ้ำจนกว่าจะมีผลตรวจ",
            tone: "waiting"
          },
          {
            label: "ผ่านแล้ว",
            value: project.status === "REPORT_APPROVED" ? 1 : 0,
            detail: "รายงานฉบับล่าสุดที่ผู้ตรวจรับรองแล้ว",
            tone: "done"
          },
          {
            label: "ประวัติ",
            value: reportHistory.length,
            detail: "จำนวนฉบับรายงานที่เก็บไว้เป็นหลักฐาน",
            tone: "info"
          }
        ]}
      />
      {project.status === "REPORT_APPROVED" ? (
        <SuccessAlert title="รายงานฉบับสมบูรณ์ผ่านการตรวจแล้ว">ขั้นตอนถัดไปคือรออาจารย์ที่ปรึกษาบันทึกคะแนนสรุปตามกระบวนการของรายวิชา</SuccessAlert>
      ) : null}
      {!gate.allowed && project.status !== "REPORT_APPROVED" ? (
        <WarningAlert title="ยังส่งเล่มไม่ได้">{reportSubmissionReasonLabel(gate.reason)}</WarningAlert>
      ) : null}
      {latestReportHasRevisionRequest ? (
        <WarningAlert title="ผู้ตรวจขอให้แก้ไขเล่มรายงาน">
          กรุณาอ่านข้อเสนอแนะของผู้ตรวจในประวัติรายงานด้านล่าง แก้ไขเล่มรายงาน แล้วส่งรายงานฉบับใหม่พร้อมสรุปการแก้ไขเป็นข้อ ๆ
        </WarningAlert>
      ) : null}
      <InfoAlert title="รูปแบบลิงก์">ใช้ลิงก์ Google Drive, Google Docs หรือ Google Classroom เท่านั้น และช่องสรุปการแก้ไขรองรับ Markdown/LaTeX</InfoAlert>
      {(
        <div className="space-y-4">
          <section className="panel">
            <h2 className="text-lg font-semibold">คำแนะนำสำหรับหลักฐานรายงาน</h2>
            <div className="mt-3 grid gap-3 text-sm text-muted md:grid-cols-2">
            <p>รายงานควรมีบทคัดย่อ ความเป็นมา วัตถุประสงค์ วิธีดำเนินงาน ผลการดำเนินงาน สรุปผล และเอกสารอ้างอิงครบถ้วน</p>
              <p>วัตถุประสงค์ วิธีดำเนินงาน และผลลัพธ์ในรายงานควรสอดคล้องกันและตรวจสอบย้อนกลับไปยังเอกสารเสนอหัวข้อได้</p>
            <p>ผลลัพธ์หรือข้อสรุปควรมีหลักฐานรองรับ เช่น การพิสูจน์ การวิเคราะห์ ชิ้นงานระบบ ผลการทดลอง หรือเอกสารประกอบที่ตรวจสอบได้</p>
            <p>สมการ รูปภาพ ตาราง และเอกสารอ้างอิงควรมีรูปแบบสม่ำเสมอ เพื่อใช้เป็นหลักฐานประกอบการประกันคุณภาพการศึกษา</p>
            </div>
          </section>
        </div>
      )}

      <FormSection title={reportActionLabel} description={reportSubmissionReasonLabel(gate.reason)}>
        {gate.allowed ? (
          <DraftPreservingForm action={submitReportVersion} storageKey={`student-report-draft:${project.id}`} clearOnSuccess={params.success === "report_submitted"} className="space-y-4">
            <MaterialLinkField name="report_drive_link" />
            <MarkdownLatexEditor
              name="report_note"
              label="สรุปการแก้ไข / ตอบกลับข้อเสนอแนะของผู้ตรวจ"
              required={false}
              rows={4}
              placeholder={`ตัวอย่างการตอบกลับข้อเสนอแนะของผู้ตรวจ

ข้อเสนอแนะที่ 1: ระบุข้อเสนอแนะของผู้ตรวจ
การแก้ไขที่ดำเนินการ: แก้ไขตามข้อเสนอแนะโดยปรับนิยาม/คำอธิบายในหัวข้อ ...
ตำแหน่งที่แก้ไขในเล่ม: บทที่ ... หน้า ... หัวข้อ ...
หลักฐานหรือเหตุผลประกอบ: เพิ่มตาราง/รูป/การพิสูจน์/ผลการทดลอง ... แล้ว

ข้อเสนอแนะที่ 2: ...
การแก้ไขที่ดำเนินการ: ...
ตำแหน่งที่แก้ไขในเล่ม: ...
หมายเหตุ: หากไม่ได้แก้ตามข้อเสนอแนะ ให้ระบุเหตุผลเชิงวิชาการอย่างชัดเจน`}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" data-draft-save className="button-secondary w-full sm:w-auto">
                บันทึกไว้ก่อน
              </button>
              <SubmitButton pendingText="กำลังส่งเล่มรายงาน..." confirmMessage="ยืนยันการส่งรายงานฉบับนี้หรือไม่?" className="w-full sm:w-auto">
                {reportActionLabel}
              </SubmitButton>
            </div>
          </DraftPreservingForm>
        ) : (
          <InfoAlert title={reportActionLabel}>{reportSubmissionReasonLabel(gate.reason)}</InfoAlert>
        )}
      </FormSection>

      <section className="panel">
        <h2 className="text-lg font-semibold">ประวัติการส่งรายงาน</h2>
        <div className="mt-3 space-y-3">
          {reportHistory.length ? (
            reportHistory.map((version) => {
              const noteEvent = project.timelineEvents.find((event) => event.relatedEntityId === version.id);
              return (
                <div key={version.id} className="rounded-md border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">ฉบับที่ {version.versionNo}</div>
                    <span className="text-xs text-muted">{formatThaiDateTime24(version.submittedAt)}</span>
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
                          <span className="ml-2">{review.decision === "PASS" ? "ผ่านการตรวจ" : "ขอแก้ไข"}</span>
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
            <EmptyState title="ยังไม่มีประวัติการส่งรายงาน" description="หลังการสอบนำเสนอขั้นสุดท้ายเสร็จสิ้น นักศึกษาจะเริ่มส่งรายงานฉบับสมบูรณ์ได้" />
          )}
        </div>
      </section>
    </div>
  );
}
