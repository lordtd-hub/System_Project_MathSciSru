import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OwnerPasswordForm } from "@/components/ui/OwnerPasswordForm";
import { getOwnerPasswordUserId } from "@/lib/auth/ownerPassword";
export const dynamic = "force-dynamic";

export default async function OwnerPasswordPage() {
  const user = (await auth())?.user;
  if (!user?.id || user.id !== getOwnerPasswordUserId() || user.role !== "ADMIN") redirect("/owner-login");
  return <div className="panel mx-auto max-w-md">
    <h1 className="text-xl font-semibold">เปลี่ยนรหัสผ่านของคุณ</h1>
    <p className="mt-2 text-sm text-muted">เมื่อเปลี่ยนรหัสผ่าน การเข้าใช้ด้วยรหัสผ่านในทุกอุปกรณ์จะสิ้นสุด ต้องเข้าสู่ระบบใหม่ด้วยรหัสผ่านใหม่</p>
    <OwnerPasswordForm mode="change" />
  </div>;
}
