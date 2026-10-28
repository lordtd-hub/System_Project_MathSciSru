import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { OwnerPasswordForm } from "@/components/ui/OwnerPasswordForm";
import { getOwnerPasswordUserId } from "@/lib/auth/ownerPassword";
export const dynamic = "force-dynamic";

export default async function OwnerLoginPage({ searchParams }: { searchParams: Promise<{ setup?: string; changed?: string }> }) {
  const ownerId = getOwnerPasswordUserId();
  if (!ownerId) notFound();
  const session = await auth();
  const query = await searchParams;
  return <div className="panel mx-auto max-w-md">
    <h1 className="text-xl font-semibold">เข้าสู่บัญชีเจ้าของระบบด้วยรหัสผ่าน</h1>
    <p className="mt-2 text-sm text-muted">สำหรับบัญชีเจ้าของระบบที่ได้รับการเปิดใช้งานแล้ว</p>
    {(query.setup === "complete" || query.changed === "complete") && <p role="status" className="mt-3 text-sm">บันทึกรหัสผ่านแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่</p>}
    {session?.user.id === ownerId && session.user.role === "ADMIN" ? <div className="mt-4 flex gap-3">
      <Link href="/admin">เปิดหน้าแอดมิน</Link><Link href="/account/password">เปลี่ยนรหัสผ่าน</Link>
    </div> : <OwnerPasswordForm mode="login" />}
    <p className="mt-4 text-sm"><Link href="/login">ตัวเลือกเข้าสู่ระบบอื่น</Link></p>
  </div>;
}
