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
import { createNavTimer } from "@/lib/diagnostics/navTiming";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "ระบบประเมินการนำเสนอโครงงาน",
  description: "Project Presentation, Feedback & Evidence System"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const timer = createNavTimer("root.layout");
  const authStart = timer.startBlock();
  const session = await auth();
  timer.endBlock("auth_session", authStart);
  const user = session?.user;
  const displayName = getSessionDisplayName(user);
  const initials = getFallbackInitials(displayName);
  const dashboardLinks = getSessionDashboardLinks(user);
  const roleLabel = getSessionRoleLabel(user);
  timer.end();

  return (
    <html lang="th">
      <body className="font-sans">
        <div className="app-shell">
          <header className="sticky top-0 z-30 border-b border-line bg-surface/95 shadow-sm backdrop-blur">
            <div className="h-1 bg-brand" />
            <div className="mx-auto flex max-w-7xl flex-col items-stretch gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
              <Link href="/" className="flex min-w-0 items-center gap-3 text-base font-semibold leading-6 text-ink transition hover:text-brand">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-white p-1 shadow-sm ring-1 ring-white">
                  <img src="/logo-mathstat-sru.jpg" alt="" className="h-full w-full rounded-md object-cover" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate">ระบบประเมินการนำเสนอโครงงาน</span>
                  <span className="block truncate text-xs font-medium uppercase tracking-[0.12em] text-muted">Mathematics & Statistics, SRU</span>
                </span>
              </Link>

              <nav className="flex flex-wrap items-center gap-2 text-sm">
                {!user ? (
                  <>
                    <a className="rounded-lg px-3 py-2 font-medium text-muted transition hover:bg-red-50 hover:text-brand" href="/admin">
                      ผู้ดูแลระบบ
                    </a>
                    <a className="rounded-lg px-3 py-2 font-medium text-muted transition hover:bg-red-50 hover:text-brand" href="/teacher">
                      อาจารย์
                    </a>
                    <a className="rounded-lg px-3 py-2 font-medium text-muted transition hover:bg-red-50 hover:text-brand" href="/student">
                      นักศึกษา
                    </a>
                  </>
                ) : null}

                {user ? (
                  <div className="flex w-full flex-col gap-2 rounded-lg border border-line bg-paperSoft p-2 shadow-sm ring-1 ring-white sm:w-auto sm:flex-row sm:items-center">
                    <div className="flex min-w-0 items-center gap-2">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-10 w-10 rounded-full border border-line bg-slate-100 object-cover shadow-sm"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand/20 bg-brand/10 text-sm font-semibold text-brand shadow-sm">
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
                  <a className="rounded-lg bg-brand px-3 py-2 text-center font-semibold text-white shadow-sm hover:bg-brandDark" href="/login">
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
