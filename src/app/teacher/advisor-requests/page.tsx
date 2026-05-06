import { auth } from "@/auth";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { reviewAdvisorRequest } from "@/app/teacher/actions";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { WarningAlert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuidancePanel } from "@/components/ui/GuidancePanel";
import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";

function waitingDays(date: Date) {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
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
    include: { project: { include: { student: true } } },
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
        next="ถ้าอนุมัติ โปรเจคจะไป PENDING_ADMIN ถ้าปฏิเสธจะกลับ DRAFT พร้อมเก็บประวัติ"
        actor="อาจารย์ที่ถูกเลือกเป็นที่ปรึกษา"
      />
      <div className="space-y-3">
        {requests.length ? (
          requests.map((request) => {
            const days = waitingDays(request.requestedAt);
            return (
              <section key={request.id} className="panel">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{request.project.currentTitleTh ?? "ยังไม่มีชื่อหัวข้อ"}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {request.project.student.studentCode} {request.project.student.firstNameTh} {request.project.student.lastNameTh}
                    </p>
                  </div>
                  <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold">{request.status}</span>
                </div>
                <p className="mt-3 text-sm text-muted">
                  ส่งคำขอเมื่อ {request.requestedAt.toLocaleString("th-TH")} · รอ {days} วัน
                </p>
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
