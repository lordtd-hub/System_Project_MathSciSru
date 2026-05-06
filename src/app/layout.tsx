/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { PageShell } from "@/components/ui/PageShell";
import {
  getFallbackInitials,
  getSessionDashboardLinks,
  getSessionRoleLabel,
  getSessionDisplayName
} from "@/lib/auth/sessionUi";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "ระบบประเมินการนำเสนอโครงงาน",
  description: "Project Presentation, Feedback & Evidence System"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const user = session?.user;
  const displayName = getSessionDisplayName(user);
  const initials = getFallbackInitials(displayName);
  const dashboardLinks = getSessionDashboardLinks(user);
  const roleLabel = getSessionRoleLabel(user);

  return (
    <html lang="th">
      <body className="font-sans">
        <div className="app-shell">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur">
            <div className="mx-auto flex max-w-7xl flex-col items-stretch gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
              <Link href="/" className="text-base font-semibold leading-6 text-ink hover:text-brand">
                ระบบประเมินการนำเสนอโครงงาน
              </Link>

              <nav className="flex flex-wrap items-center gap-2 text-sm">
                {!user ? (
                  <>
                    <a className="rounded-lg px-3 py-2 font-medium text-muted hover:bg-slate-100 hover:text-ink" href="/admin">
                      ผู้ดูแลระบบ
                    </a>
                    <a className="rounded-lg px-3 py-2 font-medium text-muted hover:bg-slate-100 hover:text-ink" href="/teacher">
                      อาจารย์
                    </a>
                    <a className="rounded-lg px-3 py-2 font-medium text-muted hover:bg-slate-100 hover:text-ink" href="/student">
                      นักศึกษา
                    </a>
                  </>
                ) : null}

                {user ? (
                  <div className="flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:w-auto sm:flex-row sm:items-center">
                    <div className="flex min-w-0 items-center gap-2">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-10 w-10 rounded-full border border-slate-200 bg-slate-100 object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand/20 bg-brand/10 text-sm font-semibold text-brand">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink">{displayName}</div>
                        {user.email && user.email !== displayName ? (
                          <div className="truncate text-xs text-muted">{user.email}</div>
                        ) : null}
                        <div className="text-xs font-semibold text-brand">{roleLabel}</div>
                      </div>
                    </div>

                    {dashboardLinks.map((link) => (
                      <a key={link.href} className="button-secondary whitespace-nowrap" href={link.href}>
                        {link.label}
                      </a>
                    ))}
                    <form
                      action={async () => {
                        "use server";
                        await signOut({ redirectTo: "/" });
                      }}
                    >
                      <button type="submit" className="button-secondary whitespace-nowrap">
                        ออกจากระบบ
                      </button>
                    </form>
                  </div>
                ) : (
                  <a className="rounded-lg bg-brand px-3 py-2 text-center font-semibold text-white shadow-sm hover:bg-teal-800" href="/login">
                    เข้าสู่ระบบ
                  </a>
                )}

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
