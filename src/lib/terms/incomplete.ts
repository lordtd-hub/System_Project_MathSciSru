import { AcademicWorkflowError } from "./errors";
import { retryScoreTransaction } from "@/lib/scoring/transactionRetry";
import type { IncompletePenaltyDecision, Prisma, PrismaClient } from "@prisma/client";
import { missingPresentationTypes, validateClosingDecisions } from "./incompletePolicy";
import { isPresentationAssessmentComplete } from "@/lib/assessments/presentationCompletion";
import { getCompletionEligibilityFromDb } from "@/lib/lifecycle/completionEligibility";
import { loadExternalEvidence } from "./incompleteExternalEvidence";

const resolutionGrades = new Set(["A", "B+", "B", "C+", "C", "D+", "D", "E", "S", "U"]);
type Db = Pick<PrismaClient, "$transaction">;
function requireText(value: string, label: string) {
  if (!value.trim() || value.length > 2000) throw new AcademicWorkflowError(`${label}ไม่ถูกต้อง`);
}
async function requireAdmin(tx: Prisma.TransactionClient, actorId: string) {
  const actor = await tx.user.findUnique({ where: { id: actorId }, select: { active: true, globalRole: true } });
  if (!actor?.active || actor.globalRole !== "ADMIN") throw new AcademicWorkflowError("ไม่มีสิทธิ์ดำเนินการ");
}
async function lockOffering(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM course_offerings WHERE id=${id} FOR UPDATE`;
  if (!rows.length) throw new AcademicWorkflowError("ไม่พบรายวิชา");
}

export function exactProjectSet(actual: string[], expected: string[]) {
  return new Set(expected).size === expected.length && JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

// Exact roster and exact unresolved IDs must be reviewed, not inferred at commit time.
export async function closeOfferingWithIncomplete(db: Db, input: {
  actorId: string; offeringId: string; expectedProjectIds: string[]; decisions: Array<{ projectId: string; grade: "I" | "E"; reason: string }>;
  reason: string; reference: string;
}) {
  requireText(input.reason, "เหตุผล"); requireText(input.reference, "หลักฐาน");
  return retryScoreTransaction(() => db.$transaction(async tx => {
    await requireAdmin(tx, input.actorId);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('course-offerings:single-active'))::text`;
    const initialOffering = await tx.courseOffering.findUniqueOrThrow({ where: { id: input.offeringId } });
    await tx.$queryRaw`SELECT id FROM terms WHERE id=${initialOffering.termId} FOR UPDATE`;
    await lockOffering(tx, input.offeringId);
    const offering = await tx.courseOffering.findUniqueOrThrow({ where: { id: input.offeringId } });
    await tx.$queryRaw`SELECT id FROM projects WHERE course_offering_id=${offering.id} ORDER BY id FOR UPDATE`;
    const projects = await tx.project.findMany({ where: { courseOfferingId: offering.id }, include: { academicResult: true, attempts: { include: { assessmentRound: { select: { roundType: true } }, evaluatorAssignments: { select: { scoreSubmission: { select: { status: true } } } } } } }, orderBy: { id: "asc" } });
    if (!exactProjectSet(projects.map(p => p.id), input.expectedProjectIds)) throw new AcademicWorkflowError("รายชื่อเปลี่ยน กรุณาตรวจใหม่");
    if (projects.some(project => project.status === "COMPLETED" && missingPresentationTypes(project.attempts).length)) throw new AcademicWorkflowError("พบงาน COMPLETED ที่หลักฐานคะแนนสอบไม่ครบ ต้องตรวจเป็นกรณี ไม่บันทึกผลหรือเติมคะแนนแทน");
    const unfinished = projects.filter(p => p.status !== "COMPLETED");
    if (!validateClosingDecisions(unfinished.map(p => p.id), input.decisions)) throw new AcademicWorkflowError("ต้องยืนยัน I หรือ E พร้อมเหตุผลให้ตรงกับผู้ที่ผลยังไม่ครบทุกคน");
    if (offering.status === "CLOSED") {
      if (unfinished.every(p => p.academicResult?.originalGrade === input.decisions.find(decision => decision.projectId === p.id)?.grade && p.academicResult?.reference === input.reference)) return { unchanged: true };
      throw new AcademicWorkflowError("รายวิชาปิดแล้ว ต้องตรวจประวัติก่อนดำเนินการ");
    }
    if (offering.status !== "ACTIVE" || unfinished.some(p => p.academicResult)) throw new AcademicWorkflowError("สถานะผลการศึกษาเปลี่ยน กรุณาตรวจใหม่");
    for (const project of unfinished) {
      const decision = input.decisions.find(item => item.projectId === project.id)!;
      await tx.projectAcademicResult.create({ data: { projectId: project.id, originalGrade: decision.grade, status: decision.grade === "I" ? "INCOMPLETE" : "FINALIZED", reason: decision.reason.trim(), reference: input.reference.trim() } });
      await tx.projectTimelineEvent.create({ data: { projectId: project.id, eventType: "ACADEMIC_RESULT_RECORDED", eventTitle: decision.grade === "I" ? "บันทึกผล I: ยังดำเนินงานต่อในภาคเรียนเดิม" : "บันทึกผล E ตามคำยืนยันผู้สอน โดยคงคะแนนจริง", eventDescription: decision.reason, actorUserId: input.actorId } });
    }
    await tx.courseOffering.update({ where: { id: offering.id }, data: { status: "CLOSED" } });
    // Term closes only after every offering in it is closed. No rounds/scores are reset.
    if (await tx.courseOffering.count({ where: { termId: offering.termId, status: { not: "CLOSED" } } }) === 0) {
      await tx.term.update({ where: { id: offering.termId }, data: { status: "CLOSED" } });
    }
    await tx.auditLog.create({ data: { actorUserId: input.actorId, action: "COURSE_RESULTS_CLOSED_WITH_I", entityType: "CourseOffering", entityId: offering.id,
      beforeJson: { status: offering.status, projectIds: input.expectedProjectIds },
      afterJson: { status: "CLOSED", decisions: input.decisions, reference: input.reference, scoresUnchanged: true }, metadataJson: { reason: input.reason } } });
    return { unchanged: false };
  }, { isolationLevel: "Serializable", timeout: 20000 }));
}

export async function openIncompleteContinuation(db: Db, input: {
  actorId: string; projectId: string; roundId: string; expectedVersion: number; reason: string; reference: string; penaltyDecision: IncompletePenaltyDecision;
}) {
  requireText(input.reason, "เหตุผล");
  requireText(input.reference, "หลักฐานคำตัดสิน penalty");
  if (!["PRESERVE_EXISTING", "NO_ADDITIONAL_PENALTY"].includes(input.penaltyDecision)) throw new AcademicWorkflowError("ต้องยืนยันนโยบาย penalty ก่อนเปิดสะสาง I");
  return retryScoreTransaction(() => db.$transaction(async tx => {
    await requireAdmin(tx, input.actorId);
    const initial = await tx.project.findUniqueOrThrow({ where: { id: input.projectId } });
    await lockOffering(tx, initial.courseOfferingId);
    await tx.$queryRaw`SELECT id FROM projects WHERE id=${input.projectId} FOR UPDATE`;
    const result = await tx.projectAcademicResult.findUnique({ where: { projectId: input.projectId } });
    if (result?.status !== "INCOMPLETE" || result.version !== input.expectedVersion) throw new AcademicWorkflowError("สถานะ I เปลี่ยน กรุณาตรวจใหม่");
    if (initial.status !== "IN_PROGRESS") throw new AcademicWorkflowError("โครงงานไม่ได้อยู่ขั้นประเมินการนำเสนอ");
    const round = await tx.assessmentRound.findUniqueOrThrow({ where: { id: input.roundId } });
    if (round.courseOfferingId !== initial.courseOfferingId || !["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENTATION"].includes(round.roundType)) throw new AcademicWorkflowError("รอบสอบไม่ตรงกับรายวิชาเดิม");
    const latest = await tx.assessmentAttempt.findFirst({ where: { projectId: initial.id, assessmentRoundId: round.id }, orderBy: { attemptNo: "desc" }, include: { evaluatorAssignments: { include: { scoreSubmission: true } } } });
    const committee = await tx.committeeAssignment.findMany({ where: { projectId: initial.id, active: true } });
    if (isPresentationAssessmentComplete({ committeeAssignments: committee, scoreSubmissions: latest?.evaluatorAssignments.map(assignment => ({ teacherId: assignment.teacherId, status: assignment.scoreSubmission?.status })) ?? [] })) throw new AcademicWorkflowError("รอบนี้มีคะแนนครบแล้ว ไม่เปิดซ้ำเพื่อสะสาง I");
    const existing = await tx.incompleteContinuation.findUnique({ where: { projectId_assessmentRoundId: { projectId: initial.id, assessmentRoundId: round.id } } });
    if (existing) {
      if (existing.status === "OPEN" && existing.penaltyDecision === input.penaltyDecision && existing.reference === input.reference) return { unchanged: true };
      throw new AcademicWorkflowError("มีคำอนุญาตเดิม ต้องตรวจประวัติก่อนเปลี่ยน");
    }
    const currentFlags = await tx.projectRoundException.findMany({ where: { projectId: initial.id, assessmentRoundId: round.id }, select: { id: true, exceptionType: true, status: true } });
    if (input.penaltyDecision === "NO_ADDITIONAL_PENALTY" && currentFlags.some(flag => flag.exceptionType === "LATE_ASSESSMENT_ROUND")) throw new AcademicWorkflowError("มี penalty เดิม ต้องคงกติกาเดิมหรือขอคำตัดสินแยก ไม่ waive โดย I");
    await tx.incompleteContinuation.create({ data: { projectId: initial.id, assessmentRoundId: round.id, reason: input.reason, reference: input.reference, penaltyDecision: input.penaltyDecision, approvedById: input.actorId } });
    await tx.auditLog.create({ data: { actorUserId: input.actorId, action: "I_CONTINUATION_OPENED", entityType: "Project", entityId: initial.id,
      beforeJson: { currentPenaltyFlags: currentFlags }, afterJson: { roundId: round.id, reason: input.reason, penaltyDecision: input.penaltyDecision, reference: input.reference, academicResultVersion: result.version, existingPenaltyFlagsUnchanged: true } } });
    await tx.projectTimelineEvent.create({ data: { projectId: initial.id, eventType: "I_CONTINUATION_OPENED", eventTitle: "เปิดเวลาสะสาง I ตามคำตัดสินเฉพาะกรณี", eventDescription: input.reason, actorUserId: input.actorId, relatedEntityType: "AssessmentRound", relatedEntityId: round.id } });
    return { unchanged: false };
  }, { isolationLevel: "Serializable" }));
}

export async function resolveIncomplete(db: Db, input: { actorId: string; projectId: string; expectedVersion: number; grade: string; reference?: string; reason?: string; useExternalEvidence?: boolean; expectedWorkflowVersion?: string }) {
  if (!resolutionGrades.has(input.grade)) throw new AcademicWorkflowError("ต้องระบุผลที่ผู้มีอำนาจยืนยัน ไม่คำนวณเกรดอัตโนมัติ");
  if (!input.useExternalEvidence) { requireText(input.reference ?? "", "หลักฐาน"); requireText(input.reason ?? "", "เหตุผล"); }
  return retryScoreTransaction(() => db.$transaction(async tx => {
    await requireAdmin(tx, input.actorId);
    const initial = await tx.project.findUniqueOrThrow({ where: { id: input.projectId } });
    await lockOffering(tx, initial.courseOfferingId);
    await tx.$queryRaw`SELECT id FROM projects WHERE id=${initial.id} FOR UPDATE`;
    const project = await tx.project.findUniqueOrThrow({ where: { id: initial.id }, include: { academicResult: true } });
    const previous = project.academicResult;
    if (previous?.status === "RESOLVED" && previous.version === input.expectedVersion + 1 && previous.resolutionGrade === input.grade
      && (input.useExternalEvidence ? previous.resolutionReference?.startsWith("ADMIN_EXTERNAL_EVIDENCE:") : previous.resolutionReference === input.reference)) return { unchanged: true };
    if (previous?.status !== "INCOMPLETE" || previous.version !== input.expectedVersion || project.status !== "COMPLETED") throw new AcademicWorkflowError("ยังสะสางงานไม่ครบ หรือสถานะ I เปลี่ยน");
    const eligibility = await getCompletionEligibilityFromDb(tx, project.id, { allowCompleted: true });
    if (!eligibility.eligible) throw new AcademicWorkflowError(`ยังสะสาง I ไม่ได้: ${eligibility.missingRequirements.join(", ")}`);
    if (input.useExternalEvidence && eligibility.workflowVersion !== input.expectedWorkflowVersion) throw new AcademicWorkflowError("คะแนนหรือหลักฐานเปลี่ยนแล้ว กรุณาตรวจข้อมูลล่าสุดก่อนบันทึกผล");
    const external = input.useExternalEvidence ? await loadExternalEvidence(tx, project.id) : null;
    if (input.useExternalEvidence && !external?.valid) throw new AcademicWorkflowError("ยังไม่มีการรับรองเอกสารจริงปัจจุบันจากผู้ดูแลระบบ");
    const reference = external?.valid ? `ADMIN_EXTERNAL_EVIDENCE:${external.latest!.id}` : input.reference!;
    const reason = external?.valid ? "ผู้ดูแลระบบตรวจเอกสารจริงและคะแนนครบแล้ว บันทึกผลที่ผู้มีอำนาจยืนยัน" : input.reason!;
    const changed = await tx.projectAcademicResult.updateMany({ where: { projectId: project.id, status: "INCOMPLETE", version: input.expectedVersion }, data: {
      status: "RESOLVED", resolutionGrade: input.grade, resolvedAt: new Date(), resolutionReason: reason, resolutionReference: reference, version: { increment: 1 }
    } });
    if (changed.count !== 1) throw new AcademicWorkflowError("สถานะ I เปลี่ยน กรุณาตรวจใหม่");
    await tx.incompleteContinuation.updateMany({ where: { projectId: project.id, status: "OPEN" }, data: { status: "RESOLVED", resolvedAt: new Date() } });
    await tx.auditLog.create({ data: { actorUserId: input.actorId, action: "ACADEMIC_I_RESOLVED", entityType: "Project", entityId: project.id,
      beforeJson: { status: previous.status, originalGrade: "I", version: previous.version, reason: previous.reason, reference: previous.reference }, afterJson: { status: "RESOLVED", grade: input.grade, reference, version: previous.version + 1 }, metadataJson: { reason } } });
    await tx.projectTimelineEvent.create({ data: { projectId: project.id, eventType: "ACADEMIC_I_RESOLVED", eventTitle: "สะสางผล I แล้ว", eventDescription: reason, actorUserId: input.actorId } });
    return { unchanged: false };
  }, { isolationLevel: "Serializable" }));
}
