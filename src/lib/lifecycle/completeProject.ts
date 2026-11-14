import type { PrismaClient } from "@prisma/client";
import { AcademicWorkflowError } from "@/lib/terms/errors";
import { workflowDigest } from "@/lib/terms/workflowDigest";
import { retryScoreTransaction } from "@/lib/scoring/transactionRetry";
import { getCompletionEligibilityFromDb } from "./completionEligibility";

export async function completeProjectAtomic(db: Pick<PrismaClient, "$transaction">, input: { actorId: string; projectId: string; expectedVersion: string; requestId: string }, hooks: { fault?: (point: string) => void | Promise<void> } = {}) {
  if (!/^[0-9a-f]{64}$/.test(input.expectedVersion) || !/^[0-9a-f-]{36}$/i.test(input.requestId)) throw new AcademicWorkflowError("กรุณาเปิดข้อมูลปัจจุบันก่อนยืนยันจบ");
  const payloadHash = workflowDigest(input);
  return retryScoreTransaction(() => db.$transaction(async tx => {
    const actor = await tx.user.findUnique({ where: { id: input.actorId }, select: { active: true, globalRole: true } });
    if (!actor?.active || actor.globalRole !== "ADMIN") throw new AcademicWorkflowError("เฉพาะผู้ดูแลระบบที่มีสิทธิ์ปัจจุบันเท่านั้น");
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"project-closeout:" + input.requestId}))::text`;
    await tx.$queryRaw`SELECT co.id FROM course_offerings co JOIN projects p ON p.course_offering_id=co.id WHERE p.id=${input.projectId} FOR SHARE OF co`;
    await tx.$queryRaw`SELECT id FROM projects WHERE id=${input.projectId} FOR UPDATE`;
    const project = await tx.project.findUniqueOrThrow({ where: { id: input.projectId } });
    const replay = await tx.auditLog.findFirst({ where: { action: "PROJECT_COMPLETED", metadataJson: { path: ["requestId"], equals: input.requestId } } });
    if (replay) {
      if (replay.actorUserId !== input.actorId || (replay.metadataJson as Record<string, unknown> | null)?.payloadHash !== payloadHash || replay.entityId !== input.projectId) throw new AcademicWorkflowError("คำขอนี้ใช้กับข้อมูลคนละรายการแล้ว");
      return { unchanged: true };
    }
    if (project.status === "COMPLETED") throw new AcademicWorkflowError("โครงงานปิดจบแล้ว กรุณาตรวจรายการปัจจุบัน");
    const eligibility = await getCompletionEligibilityFromDb(tx, project.id);
    if (eligibility.workflowVersion !== input.expectedVersion) throw new AcademicWorkflowError("คะแนน หลักฐาน หรือสถานะเปลี่ยนแล้ว กรุณาตรวจข้อมูลล่าสุดก่อนยืนยันจบ");
    if (!eligibility.eligible) throw new AcademicWorkflowError(`ยังยืนยันจบไม่ได้: ${eligibility.missingRequirements.join(", ")}`);
    const changed = await tx.project.updateMany({ where: { id: project.id, status: project.status }, data: { status: "COMPLETED" } });
    if (changed.count !== 1) throw new AcademicWorkflowError("สถานะเปลี่ยนแล้ว กรุณาเปิดข้อมูลปัจจุบัน");
    await hooks.fault?.("after_project");
    await tx.projectStatusHistory.create({ data: { projectId: project.id, fromStatus: project.status, toStatus: "COMPLETED", actorUserId: input.actorId,
      reason: eligibility.externalEvidenceId ? "ADMIN_COMPLETED_I_WITH_EXTERNAL_EVIDENCE" : "ADMIN_MARKED_COMPLETED",
      metadataJson: { externalEvidenceId: eligibility.externalEvidenceId ?? null, expectedVersion: input.expectedVersion } } });
    await tx.auditLog.create({ data: { actorUserId: input.actorId, action: "PROJECT_COMPLETED", entityType: "Project", entityId: project.id,
      beforeJson: { status: project.status }, afterJson: { status: "COMPLETED" }, metadataJson: { requestId: input.requestId, payloadHash,
        externalEvidenceId: eligibility.externalEvidenceId ?? null, actualScoresChecked: true, expectedVersion: input.expectedVersion } } });
    await hooks.fault?.("after_audit");
    await tx.projectTimelineEvent.create({ data: { projectId: project.id, actorUserId: input.actorId, eventType: "PROJECT_COMPLETED",
      eventTitle: "ผู้ดูแลระบบยืนยันจบโครงงาน", eventDescription: eligibility.externalEvidenceId ? "ตรวจคะแนนจริงครบและรับรองเอกสารภายนอกสำหรับสะสาง I โดยไม่สร้างผลตรวจครูแทน" : "ตรวจเงื่อนไขครบแล้ว",
      relatedEntityType: "Project", relatedEntityId: project.id } });
    return { unchanged: false };
  }, { isolationLevel: "Serializable", timeout: 20000 }));
}
