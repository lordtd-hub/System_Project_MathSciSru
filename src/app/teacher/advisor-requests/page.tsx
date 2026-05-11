import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { reviewAdvisorRequest } from "@/app/teacher/actions";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { WarningAlert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
import { sourceTypeLabelTh } from "@/lib/projects/sourceType";

function waitingDays(date: Date) {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function DetailBlock({
  label,
  value
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-md border border-line bg-surface p-3">
      <div className="text-xs font-semibold uppercase text-muted">{label}</div>
      <MarkdownLatexViewer className="mt-2 border-0 bg-transparent p-0 text-sm" value={value} emptyText="ยังไม่มีข้อมูล" />
    </div>
  );
}

export default async function TeacherAdvisorRequestsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!hasApprovedTeacherCapability(session?.user) || !session?.user.id) {
    return <div className="panel">หน้านี้สำหรับอาจารย์เท่านั้น</div>;
  }

  const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
  if (!teacher) {
    return <EmptyState title="ยังไม่พบโปรไฟล์อาจารย์" description="กรุณา claim โปรไฟล์ก่อนใช้งาน" />;
  }

  const requests = await prisma.advisorRequest.findMany({
    where: { advisorTeacherId: teacher.id },
    include: { project: { include: { student: true, origin: true } } },
    orderBy: { requestedAt: "desc" }
  });
  const params = (await searchParams) ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="คำขอที่ปรึกษา"
        description="ตรวจหัวข้อของนักศึกษา แล้วตอบรับหรือปฏิเสธพร้อมเหตุผล"
      />
      <ActionFeedback success={params.success} error={params.error} />
      <GuidancePanel
        title="การอนุมัติที่ปรึกษา"
        current="อ่านชื่อหัวข้อ เหตุผล และเอกสารที่นักศึกษาส่ง"
        next="ถ้าอนุมัติ โครงงานจะเข้าสู่ขั้นรอผู้ดูแลระบบยืนยัน ถ้าปฏิเสธจะกลับสู่ขั้นร่างหัวข้อพร้อมเก็บประวัติ"
        actor="อาจารย์ที่ถูกเลือกเป็นที่ปรึกษา"
      />
      <div className="space-y-3">
        {requests.length ? (
          requests.map((request) => {
            const days = waitingDays(request.requestedAt);
            const origin = request.project.origin;
            return (
              <section key={request.id} className="panel">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{request.project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
                    {request.project.currentTitleEn ? (
                      <p className="mt-1 text-sm text-muted">{request.project.currentTitleEn}</p>
                    ) : null}
                    <p className="mt-1 text-sm text-muted">
                      {request.project.student.studentCode} {request.project.student.firstNameTh} {request.project.student.lastNameTh}
                    </p>
                  </div>
                  <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold">{request.status}</span>
                </div>
                <p className="mt-3 text-sm text-muted">
                  ส่งคำขอเมื่อ {request.requestedAt.toLocaleString("th-TH")} · รอ {days} วัน
                </p>
                <div className="mt-4 rounded-md border border-line-strong bg-paper p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">รายละเอียดหัวข้อที่นักศึกษาส่ง</h3>
                    <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-muted">
                      {sourceTypeLabelTh(origin?.sourceType)}
                    </span>
                  </div>
                  {origin ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <DetailBlock label="เหตุผลที่เลือกหัวข้อ" value={origin.reasonForTopic} />
                      <DetailBlock label="ขอบเขตคณิตศาสตร์ที่เกี่ยวข้อง" value={origin.expectedMathArea} />
                      <DetailBlock label="สรุปการปรึกษาเบื้องต้น" value={origin.consultationSummary ?? request.studentMessage} />
                      <DetailBlock label="เอกสารอ้างอิงเบื้องต้น" value={origin.initialReferences} />
                      <div className="rounded-md border border-line bg-surface p-3 md:col-span-2">
                        <div className="text-xs font-semibold uppercase text-muted">ลิงก์เอกสารประกอบ</div>
                        {origin.materialLink ? (
                          <a className="mt-2 inline-flex text-sm font-semibold text-brand hover:underline" href={origin.materialLink} target="_blank" rel="noreferrer">
                            เปิดเอกสารประกอบ
                          </a>
                        ) : (
                          <p className="mt-2 text-sm text-muted">ยังไม่มีลิงก์เอกสารประกอบ</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted">ยังไม่พบรายละเอียดหัวข้อที่นักศึกษาส่ง</p>
                  )}
                </div>
                {days > 7 && request.status === "PENDING" ? (
                  <div className="mt-3">
                    <WarningAlert title="รอเกิน 7 วัน">
                      ระบบควรแจ้งเตือนอาจารย์ที่ปรึกษาและผู้ดูแลระบบ
                    </WarningAlert>
                  </div>
                ) : null}
                <form action={reviewAdvisorRequest} className="mt-4 grid gap-3">
                  <input type="hidden" name="request_id" value={request.id} />
                  <MarkdownLatexEditor name="comment" label="หมายเหตุถึงนักศึกษา" placeholder="โดยเฉพาะกรณีปฏิเสธ สามารถใช้ $...$ หรือ $$...$$ ได้" required={false} disabled={request.status !== "PENDING"} rows={3} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <SubmitButton name="decision" value="APPROVE" disabled={request.status !== "PENDING"} pendingText="กำลังบันทึก...">อนุมัติคำขอที่ปรึกษา</SubmitButton>
                    <SubmitButton name="decision" value="REJECT" className="button-danger" disabled={request.status !== "PENDING"} pendingText="กำลังบันทึก...">ปฏิเสธคำขอ</SubmitButton>
                  </div>
                </form>
              </section>
            );
          })
        ) : (
          <EmptyState
            title="ยังไม่มีคำขอที่ปรึกษารออนุมัติ"
            description="เมื่อนักศึกษาเลือกท่านเป็นที่ปรึกษา รายการจะแสดงที่นี่"
          />
        )}
      </div>
    </div>
  );
}
