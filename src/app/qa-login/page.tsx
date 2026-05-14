import { cookies } from "next/headers";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { InfoAlert, WarningAlert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { DEV_SESSION_COOKIE, decodeDevSession } from "@/lib/auth/devSession";
import {
  getQaAdminOptions,
  getQaStudentOptions,
  getQaTeacherOptions,
  hasQaLoginSecret,
  isQaLoginEnabled,
  qaPilotProjectRoles
} from "@/lib/auth/qaLogin";
import {
  MULTI_PILOT_R2_PREFIX,
  MULTI_PILOT_R2_REDESIGN_COURSE_TITLE,
  MULTI_PILOT_R2_REDESIGN_FIGMA_COURSE_TITLE,
  MULTI_PILOT_R2_WAVE2_COURSE_TITLE,
  getMultiPilotR2ScenarioCounts,
  getMultiPilotR2TeacherRoleSummary,
  multiPilotR2Projects,
  multiPilotR2Students,
  multiPilotR2Teachers,
  multiPilotR2Wave2Projects,
  multiPilotR2WavePlan
} from "@/lib/qa/multiPilotR2";
import { clearQaUser, prepareMultiPilotR2Data, prepareMultiPilotR2RedesignFigmaRegressionData, prepareMultiPilotR2RedesignRegressionData, prepareMultiPilotR2Wave2Data, prepareQaPilotIdentities, prepareQaTeacherProfiles, selectQaUser } from "./actions";

export const dynamic = "force-dynamic";

const pilotScenarios = [
  ["QA Student A", "เดิน flow ปกติจนจบ"],
  ["QA Student B", "ทดสอบการส่งงานล่าช้า"],
  ["QA Student C", "ทดสอบกรณีหลักฐาน Progress 1 ไม่ครบ"],
  ["QA Student D", "ทดสอบการแก้รายงานหลายรอบ"],
  ["QA Student E", "ทดสอบรอบสอบและตารางที่ซ้อนกัน"]
] as const;

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
  const studentOptions = getQaStudentOptions();
  const adminOptions = getQaAdminOptions();
  const r2RoleSummary = getMultiPilotR2TeacherRoleSummary();
  const r2ScenarioCounts = getMultiPilotR2ScenarioCounts();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="QA Login for Controlled Multi-User Pilot"
        description="ใช้เฉพาะ QA preview เพื่อทดสอบ workflow จริงโดยข้ามเฉพาะ Google OAuth ภายนอกเท่านั้น"
      />
      <ActionFeedback success={params.success} error={params.error} />
      <WarningAlert title="สำหรับ QA preview เท่านั้น">
        QA login ไม่ใช่ทางลัดของ workflow หลังเลือกบทบาทแล้ว route guards, role checks, lifecycle rules, server actions,
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
          <h2 className="text-lg font-semibold">เลือกบัญชีทดสอบ</h2>
          <p className="mt-1 text-sm text-muted">
            ชุดบัญชีนี้ออกแบบสำหรับ controlled multi-user pilot โดยหนึ่งอาจารย์อาจมีหลายบทบาทในหลายโปรเจกต์
          </p>
        </div>
        <form action={selectQaUser} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label htmlFor="role">บทบาท</label>
              <select id="role" name="role" required defaultValue="student">
                <option value="admin">Admin</option>
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
              </select>
            </div>
            <div>
              <label htmlFor="admin_email">Admin identity</label>
              <select id="admin_email" name="admin_email" defaultValue={adminOptions[0]?.key ?? ""}>
                {adminOptions.map((admin) => (
                  <option key={admin.key} value={admin.key}>{admin.label} · {admin.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="student_email">Student identity</label>
              <select id="student_email" name="student_email" defaultValue={studentOptions[0]?.key ?? ""}>
                {studentOptions.map((student) => (
                  <option key={student.key} value={student.key}>{student.label} · {student.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="teacher_email">Teacher identity</label>
              <select id="teacher_email" name="teacher_email" defaultValue={teacherOptions[0]?.key ?? ""} disabled={!teacherOptions.length}>
                {teacherOptions.length ? teacherOptions.map((option) => (
                  <option key={option.key} value={option.key}>{option.label} · {option.email}</option>
                )) : (
                  <option value="">ยังไม่ได้ตั้งค่า QA teacher emails</option>
                )}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="secret">QA login secret</label>
            <input
              id="secret"
              name="secret"
              type="password"
              required
              autoComplete="off"
              placeholder="กรอก secret สำหรับ QA preview"
            />
          </div>
          <button type="submit" disabled={!secretConfigured}>เข้าสู่ระบบ QA</button>
        </form>
      </section>

      <section className="panel space-y-3">
        <div>
          <h2 className="text-lg font-semibold">MULTI-PILOT-R2 operational simulation</h2>
          <p className="mt-1 text-sm text-muted">
            QA-only setup for a realistic course-scale pilot: 40 students, 11 teachers, 40 starter projects, and one isolated course offering.
          </p>
        </div>
        <form action={prepareMultiPilotR2Data} className="space-y-3 rounded-md border border-line bg-paper p-3">
          <div>
            <label htmlFor="prepare_r2_secret">QA login secret</label>
            <input id="prepare_r2_secret" name="secret" type="password" required autoComplete="off" />
          </div>
          <button type="submit" className="button-secondary" disabled={!secretConfigured}>
            เตรียมข้อมูล MULTI-PILOT-R2
          </button>
          <p className="text-xs text-muted">
            Creates or reuses the {MULTI_PILOT_R2_PREFIX} course offering, prepares synthetic roster/teacher profiles, and creates starter student projects at STUDENT_PROFILE. It does not delete old pilot history.
          </p>
        </form>
        <form action={prepareMultiPilotR2Wave2Data} className="space-y-3 rounded-md border border-line bg-paper p-3">
          <div>
            <label htmlFor="prepare_r2_wave2_secret">QA login secret</label>
            <input id="prepare_r2_wave2_secret" name="secret" type="password" required autoComplete="off" />
          </div>
          <button type="submit" className="button-secondary" disabled={!secretConfigured}>
            Prepare MULTI-PILOT-R2 Wave 2
          </button>
          <p className="text-xs text-muted">
            Creates or reuses the isolated {MULTI_PILOT_R2_WAVE2_COURSE_TITLE} with {multiPilotR2Wave2Projects.length} starter projects at STUDENT_PROFILE. Wave 1 data is preserved.
          </p>
        </form>
        <form action={prepareMultiPilotR2RedesignRegressionData} className="space-y-3 rounded-md border border-line bg-paper p-3">
          <div>
            <label htmlFor="prepare_r2_redesign_secret">QA login secret</label>
            <input id="prepare_r2_redesign_secret" name="secret" type="password" required autoComplete="off" />
          </div>
          <button type="submit" className="button-secondary" disabled={!secretConfigured}>
            Prepare Redesign Regression Offering
          </button>
          <p className="text-xs text-muted">
            Creates or reuses the isolated {MULTI_PILOT_R2_REDESIGN_COURSE_TITLE} with {multiPilotR2Wave2Projects.length} starter projects at STUDENT_PROFILE. Wave 1 and Wave 2 data are preserved.
          </p>
        </form>
        <form action={prepareMultiPilotR2RedesignFigmaRegressionData} className="space-y-3 rounded-md border border-line bg-paper p-3">
          <div>
            <label htmlFor="prepare_r2_redesign_figma_secret">QA login secret</label>
            <input id="prepare_r2_redesign_figma_secret" name="secret" type="password" required autoComplete="off" />
          </div>
          <button type="submit" className="button-secondary" disabled={!secretConfigured}>
            Prepare Redesign Figma Regression Offering
          </button>
          <p className="text-xs text-muted">
            Creates or reuses the isolated {MULTI_PILOT_R2_REDESIGN_FIGMA_COURSE_TITLE} with {multiPilotR2Wave2Projects.length} starter projects at STUDENT_PROFILE. Use it as the second safe state for classic/figma mutating parity. Wave 1 and Wave 2 data are preserved.
          </p>
        </form>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border border-line bg-paper p-3">
            <div className="text-2xl font-semibold">{multiPilotR2Students.length}</div>
            <div className="text-sm text-muted">students</div>
          </div>
          <div className="rounded-md border border-line bg-paper p-3">
            <div className="text-2xl font-semibold">{multiPilotR2Teachers.length}</div>
            <div className="text-sm text-muted">teachers</div>
          </div>
          <div className="rounded-md border border-line bg-paper p-3">
            <div className="text-2xl font-semibold">{multiPilotR2Projects.length}</div>
            <div className="text-sm text-muted">starter projects</div>
          </div>
          <div className="rounded-md border border-line bg-paper p-3">
            <div className="text-2xl font-semibold">3+1</div>
            <div className="text-sm text-muted">waves</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 pr-3">Wave</th>
                <th className="py-2 pr-3">Students</th>
                <th className="py-2 pr-3">Teachers</th>
                <th className="py-2 pr-3">Projects</th>
                <th className="py-2 pr-3">Goal</th>
              </tr>
            </thead>
            <tbody>
              {multiPilotR2WavePlan.map((wave) => (
                <tr key={wave.wave} className="border-t border-line">
                  <td className="py-2 pr-3 font-medium">{wave.wave}</td>
                  <td className="py-2 pr-3">{wave.students}</td>
                  <td className="py-2 pr-3">{wave.teachers}</td>
                  <td className="py-2 pr-3">{wave.projects}</td>
                  <td className="py-2 pr-3">{wave.goal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel space-y-3">
        <div>
          <h2 className="text-lg font-semibold">MULTI-PILOT-R2 teacher role distribution</h2>
          <p className="mt-1 text-sm text-muted">
            Designed so teachers have overlapping advisor, head committee, and member committee responsibilities across different projects.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 pr-3">Teacher</th>
                <th className="py-2 pr-3">Advisor</th>
                <th className="py-2 pr-3">Head</th>
                <th className="py-2 pr-3">Member</th>
              </tr>
            </thead>
            <tbody>
              {r2RoleSummary.map((row) => (
                <tr key={row.teacherLabel} className="border-t border-line">
                  <td className="py-2 pr-3 font-medium">{row.teacherLabel}</td>
                  <td className="py-2 pr-3">{row.advisorCount}</td>
                  <td className="py-2 pr-3">{row.headCount}</td>
                  <td className="py-2 pr-3">{row.memberCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(r2ScenarioCounts).map(([scenario, count]) => (
            <div key={scenario} className="rounded-md border border-line bg-paper p-3">
              <div className="font-semibold">{scenario}</div>
              <div className="text-sm text-muted">{count} projects</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel space-y-3">
        <div>
          <h2 className="text-lg font-semibold">บัญชีทดสอบหลัก</h2>
          <p className="mt-1 text-sm text-muted">ใช้ชื่อและอีเมลเหล่านี้เป็นหลักระหว่าง controlled multi-user pilot</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 pr-3">บทบาท</th>
                <th className="py-2 pr-3">ชื่อที่ใช้แสดง</th>
                <th className="py-2 pr-3">อีเมล</th>
                <th className="py-2 pr-3">ใช้ทดสอบอะไร</th>
              </tr>
            </thead>
            <tbody>
              {adminOptions.map((admin) => (
                <tr key={admin.key} className="border-t border-line">
                  <td className="py-2 pr-3 font-medium">{admin.role}</td>
                  <td className="py-2 pr-3">{admin.displayName}</td>
                  <td className="py-2 pr-3">{admin.email}</td>
                  <td className="py-2 pr-3">{admin.purpose}</td>
                </tr>
              ))}
              {studentOptions.map((student) => (
                <tr key={student.key} className="border-t border-line">
                  <td className="py-2 pr-3 font-medium">Student</td>
                  <td className="py-2 pr-3">{student.label} — {student.firstNameTh} {student.lastNameTh}</td>
                  <td className="py-2 pr-3">{student.email}</td>
                  <td className="py-2 pr-3">{student.purpose}</td>
                </tr>
              ))}
              {teacherOptions.map((teacher) => (
                <tr key={teacher.key} className="border-t border-line">
                  <td className="py-2 pr-3 font-medium">Teacher</td>
                  <td className="py-2 pr-3">{teacher.label}{teacher.displayName ? ` — ${teacher.displayName}` : ""}</td>
                  <td className="py-2 pr-3">{teacher.email}</td>
                  <td className="py-2 pr-3">{teacher.purpose ?? "Legacy QA identity"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel space-y-3">
        <div>
          <h2 className="text-lg font-semibold">ผังบทบาทอาจารย์ใน Multi-User Pilot</h2>
          <p className="mt-1 text-sm text-muted">ใช้ผังนี้ตอนสร้างโปรเจกต์และแต่งตั้งกรรมการ เพื่อทดสอบ queue หลายบทบาทของอาจารย์</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 pr-3">โปรเจกต์</th>
                <th className="py-2 pr-3">นักศึกษา</th>
                <th className="py-2 pr-3">ที่ปรึกษา</th>
                <th className="py-2 pr-3">ประธานกรรมการ</th>
                <th className="py-2 pr-3">กรรมการ</th>
              </tr>
            </thead>
            <tbody>
              {qaPilotProjectRoles.map((row) => (
                <tr key={row.project} className="border-t border-line">
                  <td className="py-2 pr-3 font-medium">{row.project}</td>
                  <td className="py-2 pr-3">{row.student}</td>
                  <td className="py-2 pr-3">{row.advisor}</td>
                  <td className="py-2 pr-3">{row.head}</td>
                  <td className="py-2 pr-3">{row.member}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel space-y-3">
        <h2 className="text-lg font-semibold">สถานการณ์ที่ต้องทดสอบ</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {pilotScenarios.map(([student, scenario]) => (
            <div key={student} className="rounded-md border border-line bg-paper p-3">
              <div className="font-semibold">{student}</div>
              <div className="text-sm text-muted">{scenario}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel space-y-3">
        <div>
          <h2 className="text-lg font-semibold">เตรียมข้อมูลบัญชีทดสอบ</h2>
          <p className="mt-1 text-sm text-muted">
            ปุ่มนี้สร้างหรือเปิดใช้งานเฉพาะบัญชีทดสอบใน QA preview เท่านั้น ไม่ลบข้อมูล pilot เก่าและไม่แตะข้อมูล production
          </p>
        </div>
        <form action={prepareQaPilotIdentities} className="space-y-3">
          <div>
            <label htmlFor="prepare_pilot_secret">QA login secret</label>
            <input id="prepare_pilot_secret" name="secret" type="password" required autoComplete="off" />
          </div>
          <button type="submit" className="button-secondary" disabled={!secretConfigured}>
            เตรียมบัญชี Multi-User Pilot
          </button>
          <p className="text-xs text-muted">
            ระบบจะเตรียม QA Admin, QA Student A-E และ QA Teacher Alpha-Delta ให้พร้อมสำหรับการทดสอบรอบถัดไป
          </p>
        </form>
        <form action={prepareQaTeacherProfiles} className="space-y-3 border-t border-line pt-3">
          <div>
            <label htmlFor="prepare_secret">QA login secret</label>
            <input id="prepare_secret" name="secret" type="password" required autoComplete="off" />
          </div>
          <button type="submit" className="button-secondary" disabled={!secretConfigured || teacherOptions.length < 3}>
            เตรียม Teacher profiles อย่างเดียว
          </button>
        </form>
      </section>

      <InfoAlert title="ข้อจำกัด QA Mode">
        บัญชีเหล่านี้ใช้เฉพาะ QA preview เท่านั้น ห้ามใช้ข้อมูลจริงในรอบทดสอบ บางบันทึกหลักฐานอาจแสดง actor ตามบัญชี QA login/impersonation
        และ QA secret ไม่ควรถูกบันทึกในโค้ดหรือเอกสารสาธารณะ
      </InfoAlert>
      <InfoAlert title="Legacy QA users">
        บัญชี QA ชุดเดิมยังไม่ถูกลบเพื่อรักษาประวัติ pilot เดิม หากจำเป็นต้องลบหรือย้ายข้อมูลเก่า ให้ยืนยันก่อนดำเนินการทุกครั้ง
      </InfoAlert>
    </div>
  );
}
