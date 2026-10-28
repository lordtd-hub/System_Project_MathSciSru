"use client";

import { useActionState } from "react";
import { ownerPasswordChange, ownerPasswordLogin, ownerPasswordSetup } from "@/app/owner-login/actions";

export function OwnerPasswordForm({ mode }: { mode: "login" | "setup" | "change" }) {
  const action = mode === "login" ? ownerPasswordLogin : mode === "setup" ? ownerPasswordSetup : ownerPasswordChange;
  const [state, submit, pending] = useActionState(action, { error: "" });
  return <form action={submit} className="mt-5 space-y-4">
    {mode === "login" && <label className="block">อีเมลสำหรับเข้าสู่ระบบ
      <input name="email" type="email" autoComplete="username" maxLength={254} required className="mt-1 w-full" />
    </label>}
    {mode === "setup" && <label className="block">รหัสตั้งค่าที่ได้รับจากผู้ดูแล
      <input name="code" type="password" autoComplete="off" minLength={43} maxLength={43} required className="mt-1 w-full" />
    </label>}
    {mode === "change" && <label className="block">รหัสผ่านปัจจุบัน
      <input name="currentPassword" type="password" autoComplete="current-password" maxLength={256} required className="mt-1 w-full" />
    </label>}
    <label className="block">{mode === "login" ? "รหัสผ่าน" : "รหัสผ่านใหม่ (อย่างน้อย 15 ตัวอักษร)"}
      <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"}
        maxLength={256} required className="mt-1 w-full" />
    </label>
    {mode !== "login" && <label className="block">ยืนยันรหัสผ่านใหม่
      <input name="confirm" type="password" autoComplete="new-password" maxLength={256} required className="mt-1 w-full" />
    </label>}
    <p role="status" aria-live="polite" className="text-sm text-red-700">{state.error}</p>
    <button type="submit" disabled={pending}>{pending ? "กำลังดำเนินการ…" : mode === "login" ? "เข้าสู่ระบบ" : mode === "setup" ? "ตั้งรหัสผ่าน" : "เปลี่ยนรหัสผ่าน"}</button>
  </form>;
}
