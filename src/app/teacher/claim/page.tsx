import { auth } from "@/auth";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/db";
import { teacherDisplayName } from "@/lib/teachers/displayName";
import { claimTeacherProfile } from "../actions";

export default async function TeacherClaimPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user.id || session.user.role !== "PENDING_TEACHER") {
    return <div className="panel">กรุณาเข้าสู่ระบบด้วยอีเมล @sru.ac.th</div>;
  }

  const [teachers, claims] = await Promise.all([
    prisma.teacher.findMany({ where: { userId: null, active: true }, orderBy: { firstNameTh: "asc" } }),
    prisma.teacherAccountClaim.findMany({ where: { userId: session.user.id }, include: { teacher: true } })
  ]);
  const params = (await searchParams) ?? {};

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Claim โปรไฟล์อาจารย์</h1>
      <ActionFeedback success={params.success} error={params.error} />
      {claims.length ? (
        <section className="panel">
          <h2 className="font-semibold">รายการที่ส่งแล้ว</h2>
          {claims.map((claim) => (
            <p key={claim.id} className="mt-2 text-sm">
              {teacherDisplayName(claim.teacher)}: {claim.status}
            </p>
          ))}
        </section>
      ) : null}
      <form action={claimTeacherProfile} className="panel space-y-4">
        <label>เลือกชื่อของท่าน</label>
        <select name="teacher_id" required>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacherDisplayName(teacher)}
            </option>
          ))}
        </select>
        <SubmitButton pendingText="กำลังส่งคำขอ...">ส่งคำขอ Claim</SubmitButton>
      </form>
    </div>
  );
}
