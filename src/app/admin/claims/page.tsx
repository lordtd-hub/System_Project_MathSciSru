import { auth } from "@/auth";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
import { teacherDisplayName } from "@/lib/teachers/displayName";
import { reviewTeacherClaim } from "../actions";

export default async function ClaimsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return <div className="panel">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div>;
  const params = (await searchParams) ?? {};

  const claims = await prisma.teacherAccountClaim.findMany({
    orderBy: { requestedAt: "desc" },
    include: { teacher: true, user: true }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="คำขอผูกบัญชีอาจารย์"
        description="ใช้เมื่อต้องการผูกอีเมล @sru.ac.th ของอาจารย์กับรายชื่ออาจารย์ในระบบ"
      />
      <ActionFeedback success={params.success} error={params.error} />
      <div className="space-y-3">
        {claims.length ? claims.map((claim) => (
          <form key={claim.id} action={reviewTeacherClaim} className="panel space-y-3">
            <input type="hidden" name="claim_id" value={claim.id} />
            <div className="grid gap-2 text-sm md:grid-cols-3">
              <div>
                <div className="font-medium">{teacherDisplayName(claim.teacher)}</div>
                <div className="text-muted">โปรไฟล์อาจารย์</div>
              </div>
              <div>
                <div>{claim.claimedEmail}</div>
                <div className="text-muted">อีเมลที่ claim</div>
              </div>
              <div>
                <div>{claim.status}</div>
                <div className="text-muted">สถานะ</div>
              </div>
            </div>
            {claim.status === "PENDING" ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input name="admin_note" placeholder="หมายเหตุ" />
                <SubmitButton name="decision" value="APPROVED" pendingText="กำลังบันทึก...">อนุมัติการผูกบัญชี</SubmitButton>
                <SubmitButton className="button-secondary" name="decision" value="REJECTED" pendingText="กำลังบันทึก...">ปฏิเสธคำขอ</SubmitButton>
              </div>
            ) : null}
          </form>
        )) : (
          <EmptyState title="ยังไม่มีคำขอผูกบัญชีอาจารย์" description="Teacher claims เป็นเพียงขั้นตอนเชื่อมบัญชี Google @sru.ac.th กับรายชื่ออาจารย์ ไม่ใช่ส่วนหนึ่งของการประเมิน Proposal" />
        )}
      </div>
    </div>
  );
}
