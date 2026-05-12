import { cookies } from "next/headers";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { InfoAlert, WarningAlert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { DEV_SESSION_COOKIE, decodeDevSession } from "@/lib/auth/devSession";
import { getQaTeacherOptions, hasQaLoginSecret, isQaLoginEnabled } from "@/lib/auth/qaLogin";
import { clearQaUser, prepareQaTeacherProfiles, selectQaUser } from "./actions";

export const dynamic = "force-dynamic";

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

  const [params, cookieStore] = await Promise.all([(await searchParams) ?? {}, cookies()]);
  const qaSession = decodeDevSession(cookieStore.get(DEV_SESSION_COOKIE)?.value);
  const teacherOptions = getQaTeacherOptions();

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
      {qaSession ? (
        <section className="panel flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-muted">QA session ปัจจุบัน</div>
            <div className="font-semibold">{qaSession.name} · {qaSession.role}</div>
            <div className="text-sm text-muted">{qaSession.email}</div>
          </div>
          <form action={clearQaUser}>
            <button type="submit" className="button-secondary">ออกจาก QA session</button>
          </form>
        </section>
      ) : null}
      <InfoAlert title="เวลาสลับบทบาท">
        ให้กลับมาที่หน้านี้แล้วเลือกบทบาทใหม่แทนการกด Back ของ browser เพื่อไม่ให้สับสนกับ history หรือ session จริงที่เคยเปิดไว้
      </InfoAlert>
      <section className="panel space-y-4">
        <div>
          <h2 className="text-lg font-semibold">เลือกบทบาทสำหรับทดสอบ</h2>
          <p className="mt-1 text-sm text-muted">
            Admin/Student ผูกกับ QA_ADMIN_EMAIL และ QA_STUDENT_EMAIL ส่วน Teacher สามารถเลือกหลาย identity สำหรับที่ปรึกษาและกรรมการสอบ
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
            <label htmlFor="teacher_email">Teacher identity สำหรับทดสอบกรรมการ</label>
            <select id="teacher_email" name="teacher_email" defaultValue={teacherOptions[0]?.key ?? ""} disabled={!teacherOptions.length}>
              {teacherOptions.length ? teacherOptions.map((option) => (
                <option key={option.key} value={option.key}>{option.label} · {option.email}</option>
              )) : (
                <option value="">ยังไม่ได้ตั้งค่า QA teacher emails</option>
              )}
            </select>
            <p className="mt-1 text-xs text-muted">
              ช่องนี้ใช้เมื่อเลือกบทบาท Teacher เพื่อสลับเป็นอาจารย์ที่ปรึกษา/กรรมการคนละคน โดย workflow และ permission ยังทำงานจริง
            </p>
          </div>
          {teacherOptions.length ? (
            <div className="rounded-md border border-line bg-paper p-3 text-sm">
              <div className="font-semibold">คู่มือจับคู่ QA Teacher</div>
              <p className="mt-1 text-xs text-muted">
                ชื่อที่แสดงหลังเข้าสู่ระบบมาจาก Teacher profile ในฐานข้อมูล หากชื่อในระบบไม่ตรงกับ label ด้านล่าง ให้ยึด email เป็นหลักระหว่างทดสอบ
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted">
                    <tr>
                      <th className="py-1 pr-3">QA label</th>
                      <th className="py-1 pr-3">Email</th>
                      <th className="py-1 pr-3">ใช้ทดสอบเป็น</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacherOptions.map((option) => (
                      <tr key={option.key} className="border-t border-line">
                        <td className="py-1 pr-3 font-medium">{option.label}</td>
                        <td className="py-1 pr-3">{option.email}</td>
                        <td className="py-1 pr-3">
                          {option.key.includes("advisor") || option.key === "default"
                            ? "ที่ปรึกษา"
                            : option.key.includes("committee1")
                              ? "ประธานกรรมการ"
                              : option.key.includes("committee2")
                                ? "กรรมการ"
                                : "อาจารย์ทดสอบ"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted">
                ข้อจำกัดของ QA: บางบันทึกหลักฐานจากบัญชี ADMIN • TEACHER อาจแสดงชื่อ actor ตาม session หลักของ QA ให้ใช้บทบาทที่เลือกและ email ประกอบการตรวจสอบ
              </p>
            </div>
          ) : null}
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
      <section className="panel space-y-3">
        <div>
          <h2 className="text-lg font-semibold">เตรียมอาจารย์ QA สำหรับกรรมการสอบ</h2>
          <p className="mt-1 text-sm text-muted">
            ใช้สร้าง/เปิดใช้งาน teacher profiles จาก QA teacher emails ที่ตั้งไว้ เพื่อให้ Admin เลือกเป็นที่ปรึกษาและกรรมการ 2 คนได้ในการทดสอบ pilot
          </p>
        </div>
        <form action={prepareQaTeacherProfiles} className="space-y-3">
          <div>
            <label htmlFor="prepare_secret">QA login secret</label>
            <input id="prepare_secret" name="secret" type="password" required autoComplete="off" />
          </div>
          <button type="submit" className="button-secondary" disabled={!secretConfigured || teacherOptions.length < 3}>
            เตรียม Teacher profiles สำหรับ QA
          </button>
          {teacherOptions.length < 3 ? (
            <p className="text-xs text-red-700">ต้องตั้งค่า QA teacher emails อย่างน้อย 3 อีเมลก่อน เพื่อทดสอบที่ปรึกษาและกรรมการครบ</p>
          ) : (
            <p className="text-xs text-muted">จะเตรียมอาจารย์ QA {Math.min(teacherOptions.length, 4)} profiles จาก environment ที่ตั้งไว้</p>
          )}
        </form>
      </section>
      <InfoAlert title="Setup ที่ต้องมี">
        QA Student ต้องถูก import เข้า roster แล้ว, QA Teacher profiles ต้อง active และผูก email แล้ว,
        ส่วน QA Admin จะใช้สิทธิ์ Admin สำหรับ preview/staging เท่านั้น
      </InfoAlert>
    </div>
  );
}
