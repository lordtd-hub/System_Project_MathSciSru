import { auth } from "@/auth";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { InfoAlert, WarningAlert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { hasQaLoginSecret, isQaLoginEnabled } from "@/lib/auth/qaLogin";
import { clearQaUser, selectQaUser } from "./actions";

export default async function QaLoginPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const enabled = isQaLoginEnabled();
  const secretConfigured = hasQaLoginSecret();

  if (!enabled) {
    return (
      <EmptyState
        title="QA Login is disabled"
        description="หน้านี้เปิดใช้เฉพาะ preview/staging ที่ตั้ง ENABLE_QA_LOGIN=1 และไม่แสดงเป็นทางเข้า production ปกติ"
      />
    );
  }

  const [params, session] = await Promise.all([(await searchParams) ?? {}, auth()]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="QA Login for Synthetic Pilot"
        description="ใช้เฉพาะ preview/staging เพื่อทดสอบ workflow จริงโดยข้ามเฉพาะ Google OAuth ภายนอกเท่านั้น"
      />
      <ActionFeedback success={params.success} error={params.error} />
      <WarningAlert title="Internal QA only">
        QA login ไม่ใช่ shortcut workflow หลังเลือกบทบาทแล้ว route guards, role checks, lifecycle rules, server actions,
        evidence, audit และ timeline ยังทำงานตามระบบจริง
      </WarningAlert>
      {!secretConfigured ? (
        <WarningAlert title="QA_LOGIN_SECRET ยังไม่ถูกตั้งค่า">
          ตั้งค่า QA_LOGIN_SECRET ใน environment ของ preview/staging ก่อนใช้งาน หน้านี้จะปฏิเสธการ login ทุกครั้งจนกว่าจะตั้งค่า
        </WarningAlert>
      ) : null}
      {session?.user ? (
        <section className="panel flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-muted">QA session ปัจจุบัน</div>
            <div className="font-semibold">{session.user.name} · {session.user.role}</div>
            <div className="text-sm text-muted">{session.user.email}</div>
          </div>
          <form action={clearQaUser}>
            <button type="submit" className="button-secondary">ออกจาก QA session</button>
          </form>
        </section>
      ) : null}
      <section className="panel space-y-4">
        <div>
          <h2 className="text-lg font-semibold">เลือกบทบาทสำหรับทดสอบ</h2>
          <p className="mt-1 text-sm text-muted">
            บทบาทจะผูกกับ QA_ADMIN_EMAIL, QA_TEACHER_EMAIL หรือ QA_STUDENT_EMAIL ที่ตั้งไว้ใน environment
          </p>
        </div>
        <form action={selectQaUser} className="space-y-4">
          <div>
            <label htmlFor="role">บทบาท</label>
            <select id="role" name="role" required defaultValue="student">
              <option value="admin">Admin</option>
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
            </select>
          </div>
          <div>
            <label htmlFor="secret">QA login secret</label>
            <input
              id="secret"
              name="secret"
              type="password"
              required
              autoComplete="off"
              placeholder="กรอก secret สำหรับ synthetic pilot"
            />
          </div>
          <button type="submit" disabled={!secretConfigured}>เข้าสู่ระบบ QA</button>
        </form>
      </section>
      <InfoAlert title="Setup ที่ต้องมี">
        QA Student ต้องถูก import เข้า roster แล้ว, QA Teacher ต้องมี teacher profile ที่ active และผูก email แล้ว,
        ส่วน QA Admin จะใช้สิทธิ์ Admin สำหรับ preview/staging เท่านั้น
      </InfoAlert>
    </div>
  );
}
