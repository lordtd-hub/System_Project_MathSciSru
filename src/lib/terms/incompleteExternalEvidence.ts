import type { Prisma, PrismaClient } from "@prisma/client";
import { AcademicWorkflowError } from "./errors";
import { workflowDigest } from "./workflowDigest";
import { retryScoreTransaction } from "@/lib/scoring/transactionRetry";

export const EXTERNAL_I_EVIDENCE_TYPE = "IncompleteExternalEvidence";
export const EXTERNAL_I_VERIFIED = "ADMIN_I_EXTERNAL_EVIDENCE_VERIFIED";
export const EXTERNAL_I_REVOKED = "ADMIN_I_EXTERNAL_EVIDENCE_REVOKED";
export const externalEvidenceInclude = {
  academicResult: true, courseOffering: { include: { term: true } },
  committeeAssignments: { orderBy: { id: "asc" as const } },
  advisorRequests: { orderBy: { id: "asc" as const } },
  reportVersions: { orderBy: { id: "asc" as const }, include: { reviews: { orderBy: { id: "asc" as const } } } }
} satisfies Prisma.ProjectInclude;
export type ExternalEvidenceProject = Prisma.ProjectGetPayload<{ include: typeof externalEvidenceInclude }>;
type Reader = Pick<Prisma.TransactionClient, "project" | "user" | "auditLog">;
type Db = Pick<PrismaClient, "$transaction">;
export function externalReportDigest(project: ExternalEvidenceProject) {
  return workflowDigest({ projectId: project.id, courseOfferingId: project.courseOfferingId,
    resultProjectId: project.academicResult?.projectId, resultVersion: project.academicResult?.version,
    committee: [...project.committeeAssignments].sort((a, b) => a.id.localeCompare(b.id)),
    advisors: [...project.advisorRequests].sort((a, b) => a.id.localeCompare(b.id)),
    reports: [...project.reportVersions].sort((a, b) => a.id.localeCompare(b.id)).map(report => ({ ...report, reviews: [...report.reviews].sort((a, b) => a.id.localeCompare(b.id)) })) });
}
export async function readExternalEvidence(db: Pick<Reader, "auditLog">, project: ExternalEvidenceProject) {
  const latest = await db.auditLog.findFirst({ where: { entityType: EXTERNAL_I_EVIDENCE_TYPE, entityId: project.id,
    action: { in: [EXTERNAL_I_VERIFIED, EXTERNAL_I_REVOKED] } }, orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    include: { actor: { select: { name: true } } } });
  const documentDigest = externalReportDigest(project);
  const metadata = latest?.metadataJson as Record<string, unknown> | null;
  const checks = metadata?.checks as Record<string, unknown> | undefined;
  const valid = project.courseOffering.status === "CLOSED" && project.academicResult?.status === "INCOMPLETE"
    && latest?.action === EXTERNAL_I_VERIFIED && metadata?.schemaVersion === 1 && metadata?.documentDigest === documentDigest
    && checks?.reportAccepted === true && checks?.reportCorrectionsComplete === true;
  return { valid, documentDigest, latest, version: workflowDigest({ documentDigest, latestId: latest?.id ?? null, projectStatus: project.status }) };
}
export async function loadExternalEvidence(db: Reader, projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, include: externalEvidenceInclude });
  if (!project || project.courseOffering.status !== "CLOSED" || project.academicResult?.status !== "INCOMPLETE") throw new AcademicWorkflowError("รับรองได้เฉพาะงาน I ที่ยังรอสะสางในรายวิชาปิด");
  return { project, ...await readExternalEvidence(db, project) };
}
export type ExternalEvidenceInput = { actorId: string; projectId: string; expectedVersion: string; requestId: string;
  reportAccepted: boolean; reportCorrectionsComplete: boolean; revoke?: boolean };
export async function recordExternalEvidence(db: Db, input: ExternalEvidenceInput, hooks: { fault?: (point: string) => void | Promise<void> } = {}) {
  if (!/^[0-9a-f]{64}$/.test(input.expectedVersion) || !/^[0-9a-f-]{36}$/i.test(input.requestId)) throw new AcademicWorkflowError("แบบฟอร์มไม่ถูกต้อง กรุณาเปิดข้อมูลปัจจุบันใหม่");
  if (!input.revoke && (!input.reportAccepted || !input.reportCorrectionsComplete)) throw new AcademicWorkflowError("ต้องตรวจเอกสารจริงและติ๊กให้ครบก่อนรับรอง ไม่เติมคะแนนหรือผลตรวจแทน");
  const payloadHash = workflowDigest(input);
  return retryScoreTransaction(() => db.$transaction(async tx => {
    const actor = await tx.user.findUnique({ where: { id: input.actorId }, select: { active: true, globalRole: true } });
    if (!actor?.active || actor.globalRole !== "ADMIN") throw new AcademicWorkflowError("เฉพาะผู้ดูแลระบบที่มีสิทธิ์ปัจจุบันเท่านั้น");
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"i-evidence:" + input.requestId}))::text`;
    await tx.$queryRaw`SELECT co.id FROM course_offerings co JOIN projects p ON p.course_offering_id=co.id WHERE p.id=${input.projectId} FOR SHARE OF co`;
    await tx.$queryRaw`SELECT id FROM projects WHERE id=${input.projectId} FOR UPDATE`;
    const target = await loadExternalEvidence(tx, input.projectId);
    const replay = await tx.auditLog.findFirst({ where: { entityType: EXTERNAL_I_EVIDENCE_TYPE,
      metadataJson: { path: ["requestId"], equals: input.requestId } } });
    if (replay) {
      if (replay.actorUserId !== input.actorId || (replay.metadataJson as Record<string, unknown> | null)?.payloadHash !== payloadHash) throw new AcademicWorkflowError("คำขอนี้เคยใช้กับข้อมูลคนละรายการแล้ว");
      return { unchanged: true };
    }
    if (target.version !== input.expectedVersion) throw new AcademicWorkflowError("ข้อมูลหรือการรับรองเปลี่ยนแล้ว กรุณาตรวจรายการปัจจุบันก่อนบันทึก");
    if (!input.revoke && target.valid) return { unchanged: true };
    if (input.revoke && !target.valid) throw new AcademicWorkflowError("ไม่มีการรับรองปัจจุบันที่ถอนได้ กรุณาตรวจรายการใหม่");
    const occurredAt = new Date(Math.max(Date.now(), (target.latest?.occurredAt.getTime() ?? 0) + 1));
    const event = await tx.auditLog.create({ data: { occurredAt, actorUserId: input.actorId, action: input.revoke ? EXTERNAL_I_REVOKED : EXTERNAL_I_VERIFIED,
      entityType: EXTERNAL_I_EVIDENCE_TYPE, entityId: input.projectId,
      beforeJson: { previousAttestationId: target.latest?.id ?? null, valid: target.valid },
      afterJson: { source: "ADMIN_REVIEWED_REAL_EXTERNAL_DOCUMENTS", verified: !input.revoke },
      metadataJson: { schemaVersion: 1, projectId: input.projectId, courseOfferingId: target.project.courseOfferingId,
        academicResultProjectId: target.project.academicResult!.projectId, academicResultVersion: target.project.academicResult!.version,
        documentDigest: target.documentDigest, requestId: input.requestId, payloadHash,
        checks: { reportAccepted: input.reportAccepted, reportCorrectionsComplete: input.reportCorrectionsComplete } } } });
    await hooks.fault?.("after_attestation");
    await tx.projectTimelineEvent.create({ data: { projectId: input.projectId, actorUserId: input.actorId,
      eventType: input.revoke ? EXTERNAL_I_REVOKED : EXTERNAL_I_VERIFIED,
      eventTitle: input.revoke ? "ผู้ดูแลระบบถอนการรับรองเอกสารสะสาง I" : "ผู้ดูแลระบบตรวจรับรองเอกสารจริงสำหรับสะสาง I",
      relatedEntityType: EXTERNAL_I_EVIDENCE_TYPE, relatedEntityId: event.id,
      metadataJson: { source: "ADMIN_REVIEWED_REAL_EXTERNAL_DOCUMENTS", noTeacherReviewCreated: true, noReportVersionCreated: true } } });
    await hooks.fault?.("after_timeline");
    return { unchanged: false };
  }, { isolationLevel: "Serializable", timeout: 20000 }));
}
