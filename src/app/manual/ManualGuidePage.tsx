import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ManualScreenshot } from "./ManualScreenshot";
import type { ManualGuide } from "./manualContent";

function ScopeList({ title, items, tone = "neutral" }: { title: string; items: string[]; tone?: "neutral" | "muted" }) {
  return (
    <section className={`rounded-lg border p-4 ${tone === "muted" ? "border-line bg-paperSoft" : "border-brand/20 bg-red-50"}`}>
      <h2 className="font-semibold text-ink">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ManualGuidePage({ guide }: { guide: ManualGuide }) {
  return (
    <section className="space-y-6">
      <PageHeader
        title={guide.title}
        description={guide.description}
        actions={
          <>
            <Link className="button-secondary" href="/manual">
              กลับหน้าคู่มือ
            </Link>
            <Link className="button-secondary" href={guide.role === "student" ? "/student" : "/teacher"}>
              ไปหน้า {guide.role === "student" ? "นักศึกษา" : "อาจารย์"}
            </Link>
          </>
        }
      />

      <section className="panel">
        <SectionHeading title="คู่มือนี้ใช้กับใคร" description="Audience and scope" compact />
        <p className="text-sm leading-7 text-muted">{guide.audience}</p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <ScopeList title="ครอบคลุมในคู่มือนี้" items={guide.normalScope} />
          <ScopeList title="ยังไม่ครอบคลุมในคู่มือนี้" items={guide.outOfScope} tone="muted" />
        </div>
      </section>

      <section className="panel">
        <SectionHeading title="ลำดับขั้นตอน" description="Step-by-step guide" compact />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {guide.steps.map((step, index) => (
            <a key={step.id} href={`#${step.id}`} className="rounded-lg border border-line bg-paperSoft p-4 transition hover:border-brand hover:bg-red-50">
              <div className="text-xs font-semibold text-brand">ขั้นตอนที่ {index + 1}</div>
              <div className="mt-1 font-semibold leading-6 text-ink">{step.title}</div>
            </a>
          ))}
        </div>
      </section>

      <div className="space-y-6">
        {guide.steps.map((step, index) => (
          <section key={step.id} id={step.id} className="panel scroll-mt-28">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">ขั้นตอนที่ {index + 1}</div>
                <h2 className="mt-1 text-xl font-semibold leading-8 text-ink">{step.title}</h2>
                <p className="mt-2 text-sm leading-7 text-muted">{step.purpose}</p>
              </div>
              <a className="button-secondary shrink-0" href="#top">
                กลับด้านบน
              </a>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-lg border border-line bg-paperSoft p-4">
                <h3 className="font-semibold text-ink">ให้ทำตามนี้</h3>
                <ol className="mt-3 space-y-2 text-sm leading-6 text-muted">
                  {step.actions.map((action, actionIndex) => (
                    <li key={action} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                        {actionIndex + 1}
                      </span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-lg border border-line bg-surface p-4">
                <h3 className="font-semibold text-ink">หลังทำสำเร็จควรเห็น</h3>
                <p className="mt-3 text-sm leading-7 text-muted">{step.expected}</p>
                {step.mobileNote ? (
                  <p className="mt-3 rounded-lg border border-line bg-paperSoft p-3 text-sm leading-6 text-muted">
                    หมายเหตุบนมือถือ: {step.mobileNote}
                  </p>
                ) : null}
              </div>
            </div>

            <ManualScreenshot root={guide.screenshotsRoot} file={step.screenshot} alt={`${guide.title}: ${step.title}`} />
          </section>
        ))}
      </div>
    </section>
  );
}
