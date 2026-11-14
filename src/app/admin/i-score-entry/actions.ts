"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { AdminIScoreError, recordAdminAdvisorScore, recordAdminPresentationScore } from "@/lib/scoring/adminClosedIScore";
import { advisorCriteria, type AdvisorScoreInput } from "@/lib/scoring/advisorScoring";
import type { AcademicActionResult } from "@/lib/terms/errors";
import { assertRateLimit, pilotRateLimits } from "@/lib/security/rateLimit";
import { AcademicWorkflowError } from "@/lib/terms/errors";
import { recordExternalEvidence } from "@/lib/terms/incompleteExternalEvidence";
import { completeProjectAtomic } from "@/lib/lifecycle/completeProject";
import { resolveIncomplete } from "@/lib/terms/incomplete";

function field(form: FormData, name: string, max = 100) {
  const value = String(form.get(name) ?? "").trim();
  if (!value || value.length > max) throw new AdminIScoreError("invalid_request", "ข้อมูลแบบฟอร์มไม่ครบ กรุณาเปิดหน้าปัจจุบันใหม่");
  return value;
}
function mark(form: FormData, name: string) {
  const raw = field(form, name, 10);
  if (!/^\d+(?:\.\d+)?$/.test(raw)) throw new AdminIScoreError("marks_invalid", "กรอกคะแนนจริงให้ครบทุกช่อง ช่องว่างไม่ใช่คะแนนศูนย์");
  return Number(raw);
}
export async function recordIncompleteScore(_previous: AcademicActionResult, form: FormData): Promise<AcademicActionResult> {
  try {
    const session = await auth();
    if (!session?.user.id || session.user.role !== "ADMIN") return { status: "error", message: "เฉพาะผู้ดูแลระบบเท่านั้น" };
    assertRateLimit(`admin:${session.user.id}:i-score-entry`, pilotRateLimits.scoring);
    const base = { actorUserId: session.user.id, projectId: field(form, "project_id"), evaluatorTeacherId: field(form, "evaluator_id"),
      requestId: field(form, "request_id"), expectedVersion: field(form, "version"), comment: String(form.get("comment") ?? "").trim() || null };
    const mode = field(form, "mode");
    const outcome = mode === "ADVISOR"
      ? await recordAdminAdvisorScore(prisma, { ...base, marks: Object.fromEntries(advisorCriteria.map(c => [c.key, mark(form, `mark_${c.key}`)])) as AdvisorScoreInput })
      : mode === "PRESENTATION"
        ? await recordAdminPresentationScore(prisma, { ...base, assessmentRoundId: field(form, "round_id"),
          items: form.getAll("item_id").map(id => ({ id: String(id), points: mark(form, `mark_${String(id)}`) })) })
        : (() => { throw new AdminIScoreError("invalid_mode", "ไม่พบประเภทคะแนน"); })();
    revalidatePath("/admin/i-score-entry"); revalidatePath("/admin/term-results"); revalidatePath(`/projects/${base.projectId}`);
    return { status: "success", message: outcome.unchanged ? "รายการนี้บันทึกไว้แล้ว ไม่สร้างคะแนนซ้ำ" : "บันทึกคะแนนแล้ว โดยเก็บผู้ประเมินจริงแยกจากผู้บันทึก ผล I ยังรอขั้นสะสางตามหลักฐาน" };
  } catch (error) {
    if (error instanceof AdminIScoreError) return { status: "error", message: error.message };
    return { status: "error", message: "ยังบันทึกไม่ได้ กรุณาโหลดข้อมูลปัจจุบันและตรวจคะแนนก่อนลองใหม่" };
  }
}

async function adminOperation(form: FormData, operation: (actorId: string, projectId: string) => Promise<unknown>): Promise<AcademicActionResult> {
  try {
    const session = await auth();
    if (!session?.user.id || session.user.role !== "ADMIN") throw new AcademicWorkflowError("เฉพาะผู้ดูแลระบบเท่านั้น");
    assertRateLimit(`admin:${session.user.id}:i-workflow`, pilotRateLimits.workflowMutation);
    const projectId = field(form, "project_id");
    await operation(session.user.id, projectId);
    revalidatePath("/admin/i-score-entry"); revalidatePath("/admin/closeout"); revalidatePath("/admin/term-results"); revalidatePath(`/projects/${projectId}`);
    return { status: "success", message: "บันทึกแล้ว ตรวจสถานะปัจจุบันด้านล่าง ข้อมูลเดิมและประวัติยังคงอยู่" };
  } catch (error) { return { status: "error", message: error instanceof AcademicWorkflowError || error instanceof AdminIScoreError ? error.message : "ยังบันทึกไม่ได้ กรุณาตรวจข้อมูลล่าสุดก่อนลองใหม่" }; }
}
export async function verifyIncompleteDocuments(_previous: AcademicActionResult, form: FormData) {
  return adminOperation(form, (actorId, projectId) => recordExternalEvidence(prisma, { actorId, projectId, expectedVersion: field(form, "version"), requestId: field(form, "request_id"),
    reportAccepted: form.get("report_accepted") === "on", reportCorrectionsComplete: form.get("corrections_complete") === "on", revoke: form.get("revoke") === "1" }));
}
export async function closeIncompleteProject(_previous: AcademicActionResult, form: FormData) {
  return adminOperation(form, (actorId, projectId) => completeProjectAtomic(prisma, { actorId, projectId, expectedVersion: field(form, "workflow_version"), requestId: field(form, "request_id") }));
}
export async function resolveVerifiedIncomplete(_previous: AcademicActionResult, form: FormData) {
  return adminOperation(form, (actorId, projectId) => resolveIncomplete(prisma, { actorId, projectId, expectedVersion: Number(field(form, "result_version")), grade: field(form, "grade"),
    useExternalEvidence: true, expectedWorkflowVersion: field(form, "workflow_version") }));
}
