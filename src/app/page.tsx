import { auth, signOut } from "@/auth";
import { InfoAlert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";
import { isDevLoginEnabled } from "@/lib/auth/devSession";
import { getSessionDashboardLinks, getSessionDisplayName, getSessionRoleLabel } from "@/lib/auth/sessionUi";

const roleGuides = [
  {
    title: "สำหรับอาจารย์",
    href: "/teacher",
    description: "ใช้ติดตามงานที่เกี่ยวข้องกับตนเอง เช่น คำขอเป็นที่ปรึกษา การประเมิน Proposal/Progress/Final ตารางสอบ และการตรวจเล่มรายงาน",
    steps: [
      "เข้าสู่ระบบด้วยอีเมล @sru.ac.th",
      "ถ้ายังไม่ผูกบัญชี ให้เลือกโปรไฟล์อาจารย์และรอผู้ดูแลระบบอนุมัติ",
      "เมื่อได้รับสิทธิ์แล้ว ให้ตรวจงานใน Teacher dashboard และตอบรายการที่ระบบแจ้ง"
    ],
    note: "อาจารย์จะเห็นเฉพาะงานที่เกี่ยวข้องกับบทบาทหรือการแต่งตั้งของตนเอง"
  },
  {
    title: "สำหรับนักศึกษา",
    href: "/student",
    description: "ใช้ส่งข้อมูลโครงงาน Proposal นัดสอบ ติดตาม feedback และส่งเล่มรายงานตามสถานะของโครงงาน",
    steps: [
      "เข้าสู่ระบบด้วยอีเมลรูปแบบ student_code@student.sru.ac.th",
      "ต้องมีรายชื่ออยู่ใน roster ที่ผู้ดูแลระบบนำเข้าก่อน จึงจะเข้าหน้านักศึกษาได้",
      "ทำตาม Next Action บน Student dashboard ทีละขั้น ระบบจะล็อกขั้นที่ยังไม่ถึง"
    ],
    note: "นักศึกษาจะเห็น comment/feedback ที่เปิดให้ดู แต่คะแนนบางส่วนจะถูกซ่อนตามนโยบายของรายวิชา"
  }
];

const quickLinks = [
  {
    href: "/admin",
    title: "ผู้ดูแลระบบ",
    description: "เปิดรายวิชา นำเข้านักศึกษา จัดการอาจารย์ เปิด/ปิดรอบสอบ และตรวจงานที่ต้องตัดสิน"
  },
  {
    href: "/teacher",
    title: "อาจารย์",
    description: "ดูคำขอที่ปรึกษา งานประเมิน ตารางสอบ รายงาน และคะแนนที่ต้องบันทึก"
  },
  {
    href: "/student",
    title: "นักศึกษา",
    description: "ดูขั้นตอนปัจจุบัน ส่งข้อมูลที่เปิดให้ทำ และติดตาม feedback ของโครงงาน"
  }
];

export default async function HomePage() {
  const showDevWarning = isDevLoginEnabled();
  const session = await auth();
  const user = session?.user;
  const displayName = getSessionDisplayName(user);
  const dashboardLinks = getSessionDashboardLinks(user);
  const roleLabel = getSessionRoleLabel(user);

  return (
    <section className="space-y-6">
      <PageHeader
        title="ระบบประเมินการนำเสนอโครงงาน"
        description="ระบบติดตามงานนำเสนอ Proposal, Progress 1, Progress 2, Final Presentation, feedback และหลักฐานการดำเนินงานของรายวิชา Mathematical Project Course"
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
              {user.email && user.email !== displayName ? ` (${user.email})` : ""} • {roleLabel}
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:mt-0 sm:flex-row sm:items-center">
            {dashboardLinks.map((link) => (
              <a key={link.href} className="button" href={link.href}>
                {link.label}
              </a>
            ))}
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
              ใช้บัญชี Google ของมหาวิทยาลัย อาจารย์ใช้ @sru.ac.th และนักศึกษาใช้ student_code@student.sru.ac.th
            </p>
          </div>
          <a className="button mt-4 w-full sm:mt-0 sm:w-auto" href="/login">
            เข้าสู่ระบบด้วย Google
          </a>
        </div>
      )}

      <section className="rounded-xl border border-line bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-ink">ระบบนี้ใช้ทำอะไร</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-line p-4">
            <h3 className="font-semibold text-ink">ติดตามสถานะโครงงาน</h3>
            <p className="mt-2 text-sm leading-6 text-muted">แสดงว่าตอนนี้โครงงานอยู่ขั้นใด ต้องทำอะไรต่อ และรอใครดำเนินการ</p>
          </div>
          <div className="rounded-lg border border-line p-4">
            <h3 className="font-semibold text-ink">จัดการรอบสอบและการประเมิน</h3>
            <p className="mt-2 text-sm leading-6 text-muted">รองรับ Proposal, Progress 1, Progress 2 และ Final Presentation ตามรอบของรายวิชา</p>
          </div>
          <div className="rounded-lg border border-line p-4">
            <h3 className="font-semibold text-ink">เก็บ feedback และหลักฐาน</h3>
            <p className="mt-2 text-sm leading-6 text-muted">บันทึก comment, decision, report review และ timeline เพื่อใช้ติดตามย้อนกลับได้</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {roleGuides.map((guide) => (
          <section key={guide.title} className="rounded-xl border border-line bg-white p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand">เริ่มต้นใช้งาน</div>
            <h2 className="mt-2 text-xl font-semibold text-ink">{guide.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{guide.description}</p>
            <ol className="mt-4 space-y-2 text-sm leading-6 text-muted">
              {guide.steps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-muted">{guide.note}</p>
            <a className="button-secondary mt-4 inline-flex" href={guide.href}>
              ไปหน้าทำงาน
            </a>
          </section>
        ))}
      </div>

      <section className="rounded-xl border border-line bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink">ทางลัดตามบทบาท</h2>
            <p className="mt-1 text-sm leading-6 text-muted">เลือกหน้าทำงานให้ตรงกับสิทธิ์ของบัญชีที่เข้าสู่ระบบ</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {quickLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg border border-line p-4 transition hover:border-brand hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <div className="font-semibold text-ink">{item.title}</div>
              <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
            </a>
          ))}
        </div>
      </section>
    </section>
  );
}
