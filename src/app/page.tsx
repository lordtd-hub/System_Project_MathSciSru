import Link from "next/link";
/* eslint-disable @next/next/no-img-element */
import { auth } from "@/auth";
import { InfoAlert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { isDevLoginEnabled } from "@/lib/auth/devSession";
import { getSessionDashboardLinks } from "@/lib/auth/sessionUi";
import { createNavTimer } from "@/lib/diagnostics/navTiming";

const roleGuides = [
  {
    title: "สำหรับอาจารย์",
    href: "/teacher",
    description: "ใช้ติดตามงานที่เกี่ยวข้องกับตนเอง เช่น คำขอเป็นที่ปรึกษา การประเมินการเสนอหัวข้อ/ความก้าวหน้า/ขั้นสุดท้าย ตารางสอบ และการตรวจเล่มรายงาน",
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
    description: "ใช้ส่งข้อมูลโครงงาน เอกสารเสนอหัวข้อ นัดสอบ ติดตามข้อเสนอแนะ และส่งเล่มรายงานตามสถานะของโครงงาน",
    steps: [
      "เข้าสู่ระบบด้วยอีเมลรูปแบบ student_code@student.sru.ac.th",
      "ต้องมีรายชื่ออยู่ใน roster ที่ผู้ดูแลระบบนำเข้าก่อน จึงจะเข้าหน้านักศึกษาได้",
      "ทำตาม Next Action บน Student dashboard ทีละขั้น ระบบจะล็อกขั้นที่ยังไม่ถึง"
    ],
    note: "นักศึกษาจะเห็นข้อเสนอแนะที่เปิดให้ดู แต่คะแนนบางส่วนจะถูกซ่อนตามนโยบายของรายวิชา"
  }
];

const quickLinks = [
  {
    href: "/manual",
    title: "คู่มือการใช้งาน",
    description: "อ่านขั้นตอนใช้งานสำหรับนักศึกษาและอาจารย์ พร้อมกรณีเสนอวันสอบใหม่และแก้ไขรายงาน"
  },
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
    description: "ดูขั้นตอนปัจจุบัน ส่งข้อมูลที่เปิดให้ทำ และติดตามข้อเสนอแนะของโครงงาน"
  }
];

export default async function HomePage() {
  const timer = createNavTimer("/");
  const showDevWarning = isDevLoginEnabled();
  const authStart = timer.startBlock();
  const session = await auth();
  timer.endBlock("auth_session", authStart);
  const user = session?.user;
  const dashboardLinks = getSessionDashboardLinks(user);
  timer.end();

  return (
    <section className="space-y-6">
      <PageHeader
        title="ระบบประเมินการนำเสนอโครงงาน"
        description="ระบบติดตามงานเสนอหัวข้อ สอบความก้าวหน้าครั้งที่ 1 ครั้งที่ 2 สอบนำเสนอขั้นสุดท้าย ข้อเสนอแนะ และหลักฐานการดำเนินงานของรายวิชา Mathematical Project Course"
      />

      <section className="app-card overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="p-6 sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-red-50 px-3 py-1 text-xs font-semibold text-brand">
              <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
              Mathematics & Statistics, SRU
            </div>
            <h2 className="mt-4 max-w-3xl text-2xl font-semibold leading-10 text-ink sm:text-3xl">
              ระบบกลางสำหรับติดตามโครงงาน การประเมิน และข้อเสนอแนะของรายวิชา
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
              ออกแบบให้ผู้ดูแลระบบ อาจารย์ และนักศึกษาเห็นสถานะงานที่ต้องทำตามขั้นตอนเดียวกัน ตั้งแต่การเสนอหัวข้อจนถึงการสอบความก้าวหน้า การสอบขั้นสุดท้าย รายงาน และการยืนยันจบโครงงาน
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link className="button w-full sm:w-auto" href={user ? dashboardLinks[0]?.href ?? "/login" : "/login"}>
                {user ? "ไปยังแดชบอร์ดของฉัน" : "เข้าสู่ระบบด้วย Google"}
              </Link>
              <Link className="button-secondary w-full sm:w-auto" href="/manual">
                เปิดคู่มือการใช้งาน
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-center border-t border-line bg-paperSoft p-6 lg:border-l lg:border-t-0">
            <div className="rounded-lg border border-line bg-surface p-3 shadow-md">
              <img src="/logo-mathstat-sru.jpg" alt="โลโก้สาขาคณิตศาสตร์และสถิติ มหาวิทยาลัยราชภัฏสุราษฎร์ธานี" className="h-32 w-32 rounded-md object-cover sm:h-40 sm:w-40" />
            </div>
          </div>
        </div>
      </section>

      {showDevWarning ? (
        <InfoAlert title="โหมดพัฒนา">
          ระบบกำลังทำงานในโหมดพัฒนา หากเปิด dev login ไว้ให้ใช้เฉพาะเครื่องทดสอบเท่านั้น{" "}
          <Link className="font-semibold text-brand underline" href="/dev-login">
            ไปที่โหมดทดสอบสำหรับนักพัฒนา
          </Link>
        </InfoAlert>
      ) : null}

      {!user ? (
        <div className="next-action-card next-action-primary sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div className="next-action-rail" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold text-ink">เข้าสู่ระบบเพื่อเริ่มใช้งาน</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              ใช้บัญชี Google ของมหาวิทยาลัย อาจารย์ใช้ @sru.ac.th และนักศึกษาใช้ student_code@student.sru.ac.th
            </p>
          </div>
          <Link className="button mt-4 w-full sm:mt-0 sm:w-auto" href="/login">
            เข้าสู่ระบบด้วย Google
          </Link>
        </div>
      ) : (
        <div className="next-action-card sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div className="next-action-rail" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold text-ink">เลือกแดชบอร์ดที่เกี่ยวข้องกับบัญชีนี้</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              ระบบแสดงทางเข้าตามสิทธิ์ของบัญชีที่เข้าสู่ระบบไว้แล้ว หากมีหลายบทบาทให้เลือกหน้าที่ต้องทำงานต่อ
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:mt-0 sm:flex-row">
            {dashboardLinks.map((link) => (
              <Link key={link.href} className="button-secondary whitespace-nowrap" href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <section className="panel">
        <SectionHeading title="ระบบนี้ใช้ทำอะไร" description="What this system does" compact />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-line p-4">
            <h3 className="font-semibold text-ink">ติดตามสถานะโครงงาน</h3>
            <p className="mt-2 text-sm leading-6 text-muted">แสดงว่าตอนนี้โครงงานอยู่ขั้นใด ต้องทำอะไรต่อ และรอใครดำเนินการ</p>
          </div>
          <div className="rounded-lg border border-line p-4">
            <h3 className="font-semibold text-ink">จัดการรอบสอบและการประเมิน</h3>
            <p className="mt-2 text-sm leading-6 text-muted">รองรับการเสนอหัวข้อ การสอบความก้าวหน้าครั้งที่ 1 การสอบความก้าวหน้าครั้งที่ 2 และการสอบนำเสนอขั้นสุดท้ายตามรอบของรายวิชา</p>
          </div>
          <div className="rounded-lg border border-line p-4">
            <h3 className="font-semibold text-ink">เก็บข้อเสนอแนะและหลักฐาน</h3>
            <p className="mt-2 text-sm leading-6 text-muted">บันทึกข้อเสนอแนะ ผลการพิจารณา ผลตรวจรายงาน และเหตุการณ์สำคัญเพื่อใช้ติดตามย้อนหลังได้</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {roleGuides.map((guide) => (
          <section key={guide.title} className="panel">
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
            <p className="mt-4 rounded-lg border border-line bg-paperSoft p-3 text-sm leading-6 text-muted">{guide.note}</p>
            <Link className="button-secondary mt-4 inline-flex" href={guide.href}>
              ไปหน้าทำงาน
            </Link>
          </section>
        ))}
      </div>

      <section className="panel">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink">ทางลัดตามบทบาท</h2>
            <p className="mt-1 text-sm leading-6 text-muted">เลือกหน้าทำงานให้ตรงกับสิทธิ์ของบัญชีที่เข้าสู่ระบบ</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border border-line bg-paperSoft p-4 transition hover:border-brand hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <div className="font-semibold text-ink">{item.title}</div>
              <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </section>
  );
}
