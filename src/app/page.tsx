import { auth, signOut } from "@/auth";
import { InfoAlert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";
import { isDevLoginEnabled } from "@/lib/auth/devSession";
import { getRoleDashboardHref, getRoleDashboardLabel, getSessionDisplayName } from "@/lib/auth/sessionUi";

const dashboards = [
  {
    href: "/admin",
    title: "ผู้ดูแลระบบ",
    description: "จัดการภาคเรียน นักศึกษา การอนุมัติ และการเผยแพร่ผล",
    detail: "เหมาะสำหรับติดตามงานค้าง ยืนยันโครงงาน จัดการ Proposal และแต่งตั้งกรรมการ"
  },
  {
    href: "/teacher",
    title: "อาจารย์",
    description: "อนุมัติที่ปรึกษา ประเมิน Proposal และติดตามงานที่เกี่ยวข้อง",
    detail: "เห็นคำขอที่ปรึกษา งานประเมิน ตารางสอบ และงานตรวจเล่มที่ต้องดำเนินการ"
  },
  {
    href: "/student",
    title: "นักศึกษา",
    description: "สร้างโปรเจค ส่ง Proposal เสนอวันสอบ และติดตาม feedback",
    detail: "เห็นสถานะปัจจุบัน สิ่งที่ต้องทำต่อ สิ่งที่รอคนอื่น และหลักฐานการดำเนินงาน"
  }
];

export default async function HomePage() {
  const showDevWarning = isDevLoginEnabled();
  const session = await auth();
  const user = session?.user;
  const displayName = getSessionDisplayName(user);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Project Presentation, Feedback & Evidence System"
        description="ระบบติดตามโครงงาน การสอบ Proposal/Progress/Final และหลักฐานสำหรับรายวิชา Mathematical Project Course"
      />

      {showDevWarning ? (
        <InfoAlert title="โหมดพัฒนา">
          ระบบกำลังทำงานในโหมดพัฒนา หากเปิด dev login ไว้ให้ใช้เฉพาะเครื่องทดสอบเท่านั้น{" "}
          <a className="font-semibold text-brand underline" href="/dev-login">
            ไปที่โหมดทดสอบสำหรับนักพัฒนา
          </a>
        </InfoAlert>
      ) : null}

      {user ? (
        <div className="rounded-xl border border-brand/20 bg-white p-5 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-brand">Signed in</div>
            <h2 className="mt-1 text-lg font-semibold text-ink">เข้าสู่ระบบแล้ว</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              {displayName}
              {user.email && user.email !== displayName ? ` (${user.email})` : ""} · {user.role}
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:mt-0 sm:flex-row sm:items-center">
            <a className="button" href={getRoleDashboardHref(user.role)}>
              {getRoleDashboardLabel(user.role)}
            </a>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button type="submit" className="button-secondary">
                ออกจากระบบ
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-brand/20 bg-white p-5 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <h2 className="text-lg font-semibold text-ink">เข้าสู่ระบบเพื่อเริ่มใช้งาน</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              ใช้บัญชี Google ของมหาวิทยาลัย นักศึกษาใช้ @student.sru.ac.th และอาจารย์ใช้ @sru.ac.th
            </p>
          </div>
          <a className="button mt-4 w-full sm:mt-0 sm:w-auto" href="/login">
            เข้าสู่ระบบด้วย Google
          </a>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {dashboards.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="group rounded-xl border border-line bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            <div className="flex h-full flex-col">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand">Dashboard</div>
              <h2 className="mt-2 text-xl font-semibold text-ink">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
              <p className="mt-4 flex-1 text-sm leading-6 text-muted">{item.detail}</p>
              <span className="mt-5 inline-flex text-sm font-semibold text-brand group-hover:text-teal-800">
                เข้าสู่หน้าทำงาน
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

