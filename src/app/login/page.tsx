import { auth, signIn, signOut } from "@/auth";
import { getSessionDashboardLinks, getSessionDisplayName, getSessionRoleLabel } from "@/lib/auth/sessionUi";
import { assertProductionRuntimeEnv } from "@/lib/config/env";

export default async function LoginPage() {
  const session = await auth();
  const user = session?.user;

  if (user) {
    const displayName = getSessionDisplayName(user);
    const dashboardLinks = getSessionDashboardLinks(user);
    const roleLabel = getSessionRoleLabel(user);

    return (
      <div className="mx-auto max-w-md panel">
        <div className="text-xs font-semibold uppercase tracking-wide text-brand">Signed in</div>
        <h1 className="mt-1 text-xl font-semibold">เข้าสู่ระบบแล้ว</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          {displayName}
          {user.email && user.email !== displayName ? ` (${user.email})` : ""} · {roleLabel}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
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
    );
  }

  return (
    <div className="mx-auto max-w-md panel">
      <h1 className="text-xl font-semibold">เข้าสู่ระบบ</h1>
      <p className="mt-2 text-sm text-muted">
        ใช้บัญชี Google ของมหาวิทยาลัย นักศึกษาใช้ @student.sru.ac.th และอาจารย์ใช้ @sru.ac.th
      </p>
      <form
        className="mt-5"
        action={async () => {
          "use server";
          assertProductionRuntimeEnv();
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button type="submit">เข้าสู่ระบบด้วย Google</button>
      </form>
    </div>
  );
}
