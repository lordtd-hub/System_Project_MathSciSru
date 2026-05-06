import { signIn } from "@/auth";
import { assertProductionRuntimeEnv } from "@/lib/config/env";

export default function LoginPage() {
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
