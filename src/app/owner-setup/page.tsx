import { notFound } from "next/navigation";
import { OwnerPasswordForm } from "@/components/ui/OwnerPasswordForm";
import { getOwnerPasswordUserId } from "@/lib/auth/ownerPassword";
export const dynamic = "force-dynamic";

export default function OwnerSetupPage() {
  if (!getOwnerPasswordUserId()) notFound();
  return <div className="panel mx-auto max-w-md">
    <h1 className="text-xl font-semibold">ตั้งรหัสผ่านบัญชีเจ้าของระบบ</h1>
    <p className="mt-2 text-sm text-muted">ใช้รหัสตั้งค่าที่ได้รับเป็นการส่วนตัวภายในเวลาที่กำหนด แล้วตั้งรหัสผ่านของคุณเอง การตั้งค่านี้ยังไม่ใช่การเข้าสู่ระบบ</p>
    <OwnerPasswordForm mode="setup" />
  </div>;
}
