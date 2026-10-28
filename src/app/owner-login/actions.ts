"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { changeOwnerPassword, enrollOwnerPassword, getOwnerPasswordUserId } from "@/lib/auth/ownerPassword";
import { isOwnerPasswordOriginAllowed } from "@/lib/auth/ownerPasswordOrigin";
import { getAuthBaseUrl } from "@/lib/config/env";

async function sameOrigin() {
  return isOwnerPasswordOriginAllowed((await headers()).get("origin"), getAuthBaseUrl());
}

export async function ownerPasswordLogin(_state: { error: string }, form: FormData) {
  if (!await sameOrigin() || !getOwnerPasswordUserId()) return { error: "ไม่สามารถเข้าสู่ระบบได้" };
  try {
    await signIn("owner-password", { email: form.get("email"), password: form.get("password"), redirectTo: "/admin" });
  } catch (error) {
    if (error instanceof AuthError) return { error: "ข้อมูลไม่ถูกต้องหรือมีการลองถี่เกินไป กรุณารอแล้วลองใหม่" };
    throw error; // Preserve Next.js' successful redirect; do not log request data.
  }
  return { error: "" };
}

export async function ownerPasswordSetup(_state: { error: string }, form: FormData) {
  if (!await sameOrigin() || form.get("password") !== form.get("confirm")) return { error: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง" };
  let enrolled = false;
  try { enrolled = await enrollOwnerPassword(form.get("code"), form.get("password")); }
  catch { return { error: "ไม่สามารถตั้งรหัสผ่านได้ กรุณาลองใหม่ภายหลัง" }; }
  if (!enrolled) return { error: "รหัสตั้งค่าไม่ถูกต้อง หมดอายุ ใช้แล้ว หรือรหัสผ่านไม่ผ่านเงื่อนไข" };
  redirect("/owner-login?setup=complete");
}

export async function ownerPasswordChange(_state: { error: string }, form: FormData) {
  if (!await sameOrigin() || form.get("password") !== form.get("confirm")) return { error: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง" };
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.id !== getOwnerPasswordUserId() || user.role !== "ADMIN") return { error: "กรุณาเข้าสู่ระบบเจ้าของบัญชีอีกครั้ง" };
  let changed = false;
  try { changed = await changeOwnerPassword(user.id, form.get("currentPassword"), form.get("password")); }
  catch { return { error: "ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่ภายหลัง" }; }
  if (!changed) return { error: "ข้อมูลไม่ถูกต้องหรือมีการลองถี่เกินไป กรุณาตรวจสอบรหัสผ่านเดิม" };
  // Version rotation invalidates all password sessions, including this one.
  redirect("/owner-login?changed=complete");
}
