import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "ระบบประเมินการนำเสนอโครงงาน",
  description: "Project Presentation, Feedback & Evidence System"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className="font-sans">
        <div className="app-shell">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur">
            <div className="mx-auto flex max-w-7xl flex-col items-stretch gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
              <Link href="/" className="text-base font-semibold leading-6 text-ink hover:text-brand">
                ระบบประเมินการนำเสนอโครงงาน
              </Link>
              <nav className="grid grid-cols-3 gap-2 text-sm sm:flex sm:flex-wrap sm:items-center">
                <a className="rounded-lg px-3 py-2 font-medium text-muted hover:bg-slate-100 hover:text-ink" href="/admin">
                  ผู้ดูแลระบบ
                </a>
                <a className="rounded-lg px-3 py-2 font-medium text-muted hover:bg-slate-100 hover:text-ink" href="/teacher">
                  อาจารย์
                </a>
                <a className="rounded-lg px-3 py-2 font-medium text-muted hover:bg-slate-100 hover:text-ink" href="/student">
                  นักศึกษา
                </a>
                <a className="rounded-lg bg-brand px-3 py-2 text-center font-semibold text-white shadow-sm hover:bg-teal-800" href="/login">
                  เข้าสู่ระบบ
                </a>
                {process.env.NODE_ENV === "development" ? (
                  <a className="rounded-lg bg-red-50 px-3 py-2 font-semibold text-red-700 hover:bg-red-100" href="/dev-login">
                    Dev login
                  </a>
                ) : null}
              </nav>
            </div>
          </header>
          <PageShell>{children}</PageShell>
        </div>
      </body>
    </html>
  );
}
