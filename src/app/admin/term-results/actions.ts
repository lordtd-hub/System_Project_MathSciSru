"use server";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { COURSE_OFFERING_COOKIE } from "@/lib/terms/selection";
import { prisma } from "@/lib/db";
import { closeOfferingWithIncomplete, openIncompleteContinuation, resolveIncomplete } from "@/lib/terms/incomplete";
import { assertRateLimit, pilotRateLimits } from "@/lib/security/rateLimit";
import { AcademicWorkflowError, type AcademicActionResult } from "@/lib/terms/errors";
import type { IncompletePenaltyDecision } from "@prisma/client";

async function actor() {
  const session = await auth();
  if (session?.user.role !== "ADMIN" || !session.user.id) throw new AcademicWorkflowError("ไม่มีสิทธิ์");
  assertRateLimit(`admin:${session.user.id}:academicResults`, pilotRateLimits.workflowMutation);
  return session.user.id;
}
function text(form: FormData, key: string) { return String(form.get(key) ?? "").trim(); }
function ids(form: FormData, key: string): string[] {
  const value: unknown = JSON.parse(text(form, key));
  if (!Array.isArray(value) || value.length > 500 || !value.every(id => typeof id === "string" && id.length < 100)) throw new AcademicWorkflowError("รายการไม่ถูกต้อง");
  return value;
}
async function run(operation: () => Promise<unknown>): Promise<AcademicActionResult> {
  try { await operation(); return { status: "success", message: "บันทึกแล้ว ตรวจสถานะล่าสุดในรายการด้านบน" }; }
  catch (error) { return { status: "error", message: error instanceof AcademicWorkflowError ? error.message : "ข้อมูลอาจเปลี่ยนหรือการบันทึกขัดข้อง กรุณารีเฟรชตรวจสถานะก่อนลองซ้ำ ไม่มีการส่ง REG" }; }
}
export async function closeAcademicOffering(_previous: AcademicActionResult, form: FormData): Promise<AcademicActionResult> {
  return run(async () => {
  const actorId = await actor();
  if (form.get("confirmed") !== "on") throw new AcademicWorkflowError("กรุณาตรวจรายชื่อและยืนยัน I/E ก่อน");
  const decisions = ids(form, "unfinished_ids").map(projectId => ({ projectId, grade: text(form, `result_${projectId}`) as "I" | "E", reason: text(form, `reason_${projectId}`) }));
  const offeringId = text(form, "offering_id");
  await closeOfferingWithIncomplete(prisma, { actorId, offeringId, expectedProjectIds: ids(form, "project_ids"), decisions, reason: text(form, "reason"), reference: text(form, "reference") });
  // Keep the just-reviewed course visible when another offering remains ACTIVE.
  (await cookies()).set(COURSE_OFFERING_COOKIE, offeringId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  revalidatePath("/", "layout");
  });
}
export async function continueIncompleteRound(_previous: AcademicActionResult, form: FormData): Promise<AcademicActionResult> {
  return run(async () => {
  await openIncompleteContinuation(prisma, { actorId: await actor(), projectId: text(form, "project_id"), roundId: text(form, "round_id"), expectedVersion: Number(text(form, "version")), reason: text(form, "reason"), reference: text(form, "reference"), penaltyDecision: text(form, "penalty_decision") as IncompletePenaltyDecision });
  revalidatePath("/", "layout");
  });
}
export async function resolveAcademicIncomplete(_previous: AcademicActionResult, form: FormData): Promise<AcademicActionResult> {
  return run(async () => {
  await resolveIncomplete(prisma, { actorId: await actor(), projectId: text(form, "project_id"), expectedVersion: Number(text(form, "version")), grade: text(form, "grade"), reference: text(form, "reference"), reason: text(form, "reason") });
  revalidatePath("/", "layout");
  });
}
