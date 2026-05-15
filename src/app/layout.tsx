/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { PageShell } from "@/components/ui/PageShell";
import {
  getFallbackInitials,
  getSessionDashboardLinks,
  getSessionRoleLabel,
  getSessionDisplayName
} from "@/lib/auth/sessionUi";
import { DEV_SESSION_COOKIE, decodeDevSession } from "@/lib/auth/devSession";
import { isQaLoginEnabled } from "@/lib/auth/qaLogin";
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
  const cookieStore = await cookies();
  const qaSession = isQaLoginEnabled() ? decodeDevSession(cookieStore.get(DEV_SESSION_COOKIE)?.value) : null;
  timer.end();

  return (
    <html lang="th">
      <body className="font-sans">
        <div className="app-shell">
          <header className="sticky top-0 z-30 border-b border-line bg-surface/95 shadow-sm backdrop-blur">
            <div className="h-1 bg-brand" />
            <div className="mx-auto flex max-w-7xl flex-col items-stretch gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6 sm:py-3 lg:px-8">
              <Link href="/" className="flex min-w-0 items-center gap-2.5 text-sm font-semibold leading-5 text-ink transition hover:text-brand sm:gap-3 sm:text-base sm:leading-6">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white p-1 shadow-sm ring-1 ring-white sm:h-11 sm:w-11">
                  <img src="/logo-mathstat-sru.jpg" alt="" className="h-full w-full rounded-md object-cover" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate">ระบบประเมินการนำเสนอโครงงาน</span>
                  <span className="block truncate text-[10px] font-medium uppercase tracking-[0.1em] text-muted sm:text-xs sm:tracking-[0.12em]">Mathematics & Statistics, SRU</span>
                </span>
              </Link>

              <nav className="flex flex-wrap items-center gap-1.5 text-sm sm:gap-2">
                {!user ? (
                  <>
                    <Link className="rounded-lg px-3 py-2 font-medium text-muted transition hover:bg-red-50 hover:text-brand" href="/admin">
                      ผู้ดูแลระบบ
                    </Link>
                    <Link className="rounded-lg px-3 py-2 font-medium text-muted transition hover:bg-red-50 hover:text-brand" href="/teacher">
                      อาจารย์
                    </Link>
                    <Link className="rounded-lg px-3 py-2 font-medium text-muted transition hover:bg-red-50 hover:text-brand" href="/student">
                      นักศึกษา
                    </Link>
                  </>
                ) : null}

                {user ? (
                  <div className="flex w-full flex-wrap items-center gap-1.5 rounded-lg border border-line bg-paperSoft p-1.5 shadow-sm ring-1 ring-white sm:w-auto sm:flex-row sm:gap-2 sm:p-2">
                    <div className="mr-auto flex min-w-0 flex-1 items-center gap-2 sm:mr-0 sm:flex-none">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-8 w-8 rounded-full border border-line bg-slate-100 object-cover shadow-sm sm:h-10 sm:w-10"
                        />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand/20 bg-brand/10 text-xs font-semibold text-brand shadow-sm sm:h-10 sm:w-10 sm:text-sm">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-ink sm:text-sm">{displayName}</div>
                        {user.email && user.email !== displayName ? (
                          <div className="hidden truncate text-xs text-muted sm:block">{user.email}</div>
                        ) : null}
                        <div className="text-[11px] font-semibold leading-4 text-brand sm:text-xs">{roleLabel}</div>
                      </div>
                    </div>

                    {dashboardLinks.map((link) => (
                      <Link key={link.href} className="button-secondary mobile-header-control whitespace-nowrap" href={link.href}>
                        {link.label}
                      </Link>
                    ))}
                    {qaSession ? (
                      <Link className="button-secondary mobile-header-control whitespace-nowrap" href="/qa-login">
                        กลับหน้า QA Login
                      </Link>
                    ) : null}
                    <form
                      action={async () => {
                        "use server";
                        await signOut({ redirectTo: "/" });
                      }}
                    >
                      <button type="submit" className="button-secondary mobile-header-control whitespace-nowrap">
                        <span className="sm:hidden">ออก</span>
                        <span className="hidden sm:inline">ออกจากระบบ</span>
                      </button>
                    </form>
                  </div>
                ) : (
                  <Link className="rounded-lg bg-brand px-3 py-2 text-center font-semibold text-white shadow-sm hover:bg-brandDark" href="/login">
                    เข้าสู่ระบบ
                  </Link>
                )}

                {process.env.NODE_ENV === "development" ? (
                  <Link className="rounded-lg bg-red-50 px-3 py-2 font-semibold text-red-700 hover:bg-red-100" href="/dev-login">
                    Dev login
                  </Link>
                ) : null}
              </nav>
            </div>
          </header>
          <PageShell>{children}</PageShell>
          <footer className="mx-auto w-full max-w-7xl px-4 pb-8 pt-2 text-center text-xs leading-6 text-muted sm:px-6 lg:px-8">
            <div>ออกแบบแนวคิดระบบและกระบวนการประเมินโดย สิทธิโชค ทรงสอาด</div>
            <div>สาขาวิชาคณิตศาสตร์ คณะวิทยาศาสตร์และเทคโนโลยี มหาวิทยาลัยราชภัฏสุราษฎร์ธานี</div>
            <a className="font-medium text-brand hover:underline" href="mailto:sittichoke.son@sru.ac.th">
              sittichoke.son@sru.ac.th
            </a>
          </footer>
        </div>
      </body>
    </html>
  );
}
