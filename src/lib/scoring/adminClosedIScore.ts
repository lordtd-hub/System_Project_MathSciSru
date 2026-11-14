import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { retryScoreTransaction } from "./transactionRetry";
import { normalizeTeacherScoreSnapshot } from "./scoreSnapshots";
import { requiresLateRoundPenalty, applyLatePenalty } from "@/lib/assessments/roundExceptions";
import { isPresentationAssessmentComplete } from "@/lib/assessments/presentationCompletion";
import { findProgressQaCriterion } from "@/lib/rubrics/progressQaRubric";
import { findFinalQaCriterion } from "@/lib/rubrics/finalQaRubric";
import { advisorCriteria, totalAdvisorScore, validateAdvisorScore, type AdvisorScoreInput } from "./advisorScoring";
import { validateMarkdownInput } from "@/lib/validators/submissionContent";
import { loadExternalEvidence } from "@/lib/terms/incompleteExternalEvidence";

export class AdminIScoreError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = "AdminIScoreError"; }
}
type Reader = Pick<Prisma.TransactionClient, "user" | "project" | "teacher" | "assessmentRound" | "assessmentAttempt" | "rubric" | "auditLog" | "advisorScore">;
type Db = Pick<PrismaClient, "$transaction">;
type Target = { actorUserId: string; projectId: string; evaluatorTeacherId: string };
export type AdminPresentationInput = Target & {
  assessmentRoundId: string; expectedVersion: string; requestId: string;
  items: Array<{ id: string; points: number }>; comment: string | null;
};
export type AdminAdvisorInput = Target & { expectedVersion: string; requestId: string; marks: AdvisorScoreInput; comment: string | null };
type Hooks = { fault?: (point: string) => void | Promise<void> };
const action = "ADMIN_CLOSED_I_SCORE_RECORDED";
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
function canonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ":" + canonical(v)).join(",") + "}";
  return JSON.stringify(value);
}
const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
function checkSubmission(input: { requestId: string; expectedVersion: string; comment: string | null }) {
  if (!/^[0-9a-f-]{36}$/i.test(input.requestId) || !/^[0-9a-f]{64}$/.test(input.expectedVersion)) throw new AdminIScoreError("invalid_request", "ข้อมูลรายการไม่ถูกต้อง กรุณาโหลดหน้าปัจจุบันใหม่");
  if (input.comment && (input.comment.length > 2000 || validateMarkdownInput(input.comment, "หมายเหตุ").length)) throw new AdminIScoreError("invalid_comment", "หมายเหตุไม่ถูกต้อง");
}
async function actor(db: Reader, actorUserId: string) {
  const user = await db.user.findUnique({ where: { id: actorUserId }, select: { active: true, globalRole: true } });
  if (!user?.active || user.globalRole !== "ADMIN") throw new AdminIScoreError("admin_required", "เฉพาะผู้ดูแลระบบที่มีสิทธิ์ปัจจุบันเท่านั้น");
}
async function context(db: Reader, target: Target) {
  await actor(db, target.actorUserId);
  const project = await db.project.findUnique({ where: { id: target.projectId }, include: {
    academicResult: true, courseOffering: { include: { term: true } }, committeeAssignments: true, advisorRequests: true
  } });
  if (!project || project.courseOffering.status !== "CLOSED" || project.academicResult?.status !== "INCOMPLETE") throw new AdminIScoreError("closed_i_required", "ใช้ได้เฉพาะงาน I ที่ยังรอสะสางของรายวิชาปิดผลแล้ว");
  const evaluator = await db.teacher.findUnique({ where: { id: target.evaluatorTeacherId } });
  if (!evaluator?.active) throw new AdminIScoreError("evaluator_invalid", "ไม่พบผู้ประเมินที่ใช้งานอยู่");
  return { project, evaluator };
}
async function version(db: Reader, entityType: string, entityId: string | undefined, snapshot: unknown) {
  const audit = entityId ? await db.auditLog.findFirst({ where: { entityType, entityId }, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], select: { id: true } }) : null;
  return digest({ entityId: entityId ?? null, auditId: audit?.id ?? null, snapshot });
}
export function allowedAdminRubricPoints(roundType: string, item: { itemKey: string; points: number }) {
  const criterion = roundType === "FINAL_PRESENTATION" ? findFinalQaCriterion(item.itemKey) : findProgressQaCriterion(item.itemKey);
  return criterion ? [...new Set(criterion.scoreMappings.map(mapping => mapping.score))].sort((a, b) => a - b) : [0, item.points];
}
export function preserveAdminIPenalty(previous: { totalScore: number; items: Array<{ points: number }> } | null, priorPercent: unknown, currentLateFlag: boolean) {
  if (!previous) return currentLateFlag;
  const raw = previous.items.reduce((sum, item) => sum + item.points, 0);
  if (priorPercent === 10) {
    if (!previous.items.length || Math.abs(applyLatePenalty(raw) - previous.totalScore) > 0.011) throw new AdminIScoreError("penalty_history_conflict", "คะแนนและประวัติหักคะแนนเดิมไม่ตรงกัน ต้องตรวจประวัติก่อนบันทึก");
    return true;
  }
  // Never silently remove an earlier deduction when a late exception has been closed.
  if (!previous.items.length || Math.abs(raw - previous.totalScore) > 0.011) throw new AdminIScoreError("penalty_history_missing", "คะแนนเดิมมีส่วนปรับที่ยังยืนยันกติกาไม่ได้ ต้องตรวจประวัติก่อน ระบบไม่ยกเว้นการหักคะแนนเพราะ I");
  return currentLateFlag;
}
export async function loadAdminPresentationTarget(db: Reader, target: Target & { assessmentRoundId: string }) {
  const result = await context(db, target);
  if (!["IN_PROGRESS", "FINAL_DONE", "REPORT_REVIEW", "REPORT_APPROVED", "ADVISOR_SCORING"].includes(result.project.status)) throw new AdminIScoreError("project_not_ready", "โครงงานยังไม่ถึงขั้นประเมินการนำเสนอ หรือปิดโครงงานแล้ว ต้องตรวจขั้นตอนเดิมก่อน");
  const round = await db.assessmentRound.findUnique({ where: { id: target.assessmentRoundId } });
  if (!round || !["PROGRESS_1", "PROGRESS_2", "FINAL_PRESENTATION"].includes(round.roundType) || round.courseOfferingId !== result.project.courseOfferingId) throw new AdminIScoreError("round_invalid", "รอบสอบไม่ตรงกับโครงงาน");
  if (!result.project.committeeAssignments.some(a => a.active && a.teacherId === result.evaluator.id && ["HEAD", "MEMBER"].includes(a.role))) throw new AdminIScoreError("evaluator_not_assigned", "ผู้ประเมินต้องเป็นประธานหรือกรรมการที่แต่งตั้งในโครงงานนี้");
  if (!result.evaluator.userId) throw new AdminIScoreError("evaluator_identity_unlinked", "ผู้ประเมินยังไม่มีตัวตนผู้ใช้ที่ผูกไว้ ระบบจะไม่สร้างหรือสวมบัญชีแทน");
  const attempt = await db.assessmentAttempt.findFirst({ where: { projectId: target.projectId, assessmentRoundId: round.id }, orderBy: { attemptNo: "desc" }, include: {
    evaluatorAssignments: { include: { scoreSubmission: { include: { scoreItems: { include: { rubricItem: true } } } } } }
  } });
  const assignment = attempt?.evaluatorAssignments.find(a => a.evaluatorUserId === result.evaluator.userId);
  if (assignment && assignment.teacherId !== result.evaluator.id) throw new AdminIScoreError("evaluator_identity_changed", "ตัวตนผู้ประเมินเดิมไม่ตรง ต้องตรวจประวัติก่อน");
  const previous = assignment?.scoreSubmission;
  const rubricIds = [...new Set(previous?.scoreItems.map(item => item.rubricItem.rubricId) ?? [])];
  if (rubricIds.length > 1) throw new AdminIScoreError("rubric_conflict", "เกณฑ์คะแนนเดิมไม่ตรงกัน ต้องตรวจประวัติก่อน");
  const rubric = rubricIds.length ? await db.rubric.findUnique({ where: { id: rubricIds[0] }, include: { items: { orderBy: { displayOrder: "asc" } } } })
    : await db.rubric.findFirst({ where: { roundType: round.roundType, active: true }, orderBy: { version: "desc" }, include: { items: { orderBy: { displayOrder: "asc" } } } });
  if (!rubric?.items.length || rubric.roundType !== round.roundType) throw new AdminIScoreError("rubric_missing", "ไม่พบเกณฑ์ที่ตรงกับรอบสอบ");
  const snapshot = previous ? { status: previous.status, submittedAt: previous.submittedAt, lockedAt: previous.lockedAt,
    totalScore: Number(previous.totalScore), comment: previous.overallComment,
    items: previous.scoreItems.map(i => ({ id: i.rubricItemId, points: Number(i.pointsAwarded), checked: i.checked })).sort((a, b) => a.id.localeCompare(b.id)) } : null;
  return { ...result, round, attempt, assignment, previous, rubric, snapshot, version: await version(db, "ScoreSubmission", previous?.id, { projectId: target.projectId, evaluatorTeacherId: target.evaluatorTeacherId, roundId: round.id, attemptNo: attempt?.attemptNo ?? 1, rubricId: rubric.id, snapshot }) };
}
async function replay(db: Reader, requestId: string, actorUserId: string, payloadHash: string) {
  const previous = await db.auditLog.findFirst({ where: { action, metadataJson: { path: ["requestId"], equals: requestId } }, select: { actorUserId: true, metadataJson: true } });
  if (!previous) return false;
  const metadata = previous.metadataJson as Record<string, unknown> | null;
  if (previous.actorUserId !== actorUserId || metadata?.payloadHash !== payloadHash) throw new AdminIScoreError("request_reused", "คำขอนี้เคยบันทึกข้อมูลคนละรายการแล้ว กรุณาโหลดหน้าใหม่");
  return true;
}
export async function recordAdminPresentationScore(db: Db, input: AdminPresentationInput, hooks: Hooks = {}) {
  checkSubmission(input);
  const payloadHash = digest({ ...input, items: [...input.items].sort((a, b) => a.id.localeCompare(b.id)) });
  return retryScoreTransaction(() => db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"admin-i-entry:" + input.requestId}))::text`;
    await tx.$queryRaw`SELECT co.id FROM course_offerings co JOIN projects p ON p.course_offering_id=co.id WHERE p.id=${input.projectId} FOR SHARE OF co`;
    await tx.$queryRaw`SELECT id FROM projects WHERE id=${input.projectId} FOR UPDATE`;
    const target = await loadAdminPresentationTarget(tx, input);
    if (await replay(tx, input.requestId, input.actorUserId, payloadHash)) return { unchanged: true };
    if (target.version !== input.expectedVersion) throw new AdminIScoreError("version_conflict", "คะแนนเปลี่ยนแล้ว กรุณาตรวจค่าปัจจุบันก่อนบันทึกใหม่");
    if (input.items.length !== target.rubric.items.length || new Set(input.items.map(i => i.id)).size !== input.items.length) throw new AdminIScoreError("marks_incomplete", "ต้องกรอกคะแนนจริงให้ครบทุกเกณฑ์ ไม่เติมช่องว่างเป็นศูนย์");
    const items = target.rubric.items.map(item => {
      const mark = input.items.find(mark => mark.id === item.id);
      const allowed = allowedAdminRubricPoints(target.round.roundType, item);
      if (!mark || !Number.isFinite(mark.points) || mark.points < 0 || mark.points > item.points || (allowed ? !allowed.includes(mark.points) : !Number.isInteger(mark.points))) throw new AdminIScoreError("marks_invalid", "คะแนนไม่ตรงกับเกณฑ์ที่ใช้ประเมิน");
      return { id: item.id, itemKey: item.itemKey, pointsAwarded: mark.points, checked: mark.points > 0 };
    });
    const flags = await tx.projectRoundException.findMany({ where: { projectId: input.projectId, assessmentRoundId: target.round.id, status: "OPEN" }, select: { exceptionType: true, status: true } });
    const rawTotalScore = items.reduce((sum, item) => sum + item.pointsAwarded, 0);
    const priorAudit = target.previous ? await tx.auditLog.findFirst({ where: { entityType: "ScoreSubmission", entityId: target.previous.id,
      OR: [{ metadataJson: { path: ["latePenaltyPercent"], equals: 10 } }, { metadataJson: { path: ["latePenaltyPercent"], equals: 0 } }] },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }], select: { metadataJson: true } }) : null;
    const priorPercent = (priorAudit?.metadataJson as Record<string, unknown> | null)?.latePenaltyPercent;
    const penalty = preserveAdminIPenalty(target.snapshot, priorPercent, requiresLateRoundPenalty(flags)), totalScore = penalty ? applyLatePenalty(rawTotalScore) : rawTotalScore;
    const attempt = target.attempt ?? await tx.assessmentAttempt.create({ data: { projectId: input.projectId, assessmentRoundId: target.round.id, attemptNo: 1,
      attemptType: target.round.roundType === "FINAL_PRESENTATION" ? "FINAL_PRESENTATION" : target.round.roundType === "PROGRESS_1" ? "PROGRESS_1" : "PROGRESS_2", status: "SCORING_OPEN" } });
    const assignment = target.assignment ?? await tx.evaluatorAssignment.create({ data: { assessmentAttemptId: attempt.id,
      evaluatorUserId: target.evaluator.userId!, teacherId: target.evaluator.id,
      evaluatorDisplayNameSnapshot: target.evaluator.academicPrefix + target.evaluator.firstNameTh + " " + target.evaluator.lastNameTh, isRequired: true } });
    await hooks.fault?.("after_assignment");
    const now = new Date();
    const submission = await tx.scoreSubmission.upsert({ where: { evaluatorAssignmentId: assignment.id },
      update: { totalScore, overallComment: input.comment, status: "SUBMITTED", submittedAt: now, lockedAt: now },
      create: { evaluatorAssignmentId: assignment.id, totalScore, overallComment: input.comment, status: "SUBMITTED", submittedAt: now, lockedAt: now } });
    await hooks.fault?.("after_submission");
    for (const item of items) await tx.scoreItem.upsert({ where: { scoreSubmissionId_rubricItemId: { scoreSubmissionId: submission.id, rubricItemId: item.id } },
      update: { pointsAwarded: item.pointsAwarded, checked: item.checked }, create: { scoreSubmissionId: submission.id, rubricItemId: item.id, pointsAwarded: item.pointsAwarded, checked: item.checked } });
    await tx.evaluatorAssignment.update({ where: { id: assignment.id }, data: { status: "SUBMITTED" } });
    await hooks.fault?.("after_items");
    const afterSnapshot = normalizeTeacherScoreSnapshot({ totalScore, overallComment: input.comment, items: items.map(i => ({ rubricItemId: i.id, itemKey: i.itemKey, checked: i.checked, pointsAwarded: i.pointsAwarded })) });
    await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action, entityType: "ScoreSubmission", entityId: submission.id,
      beforeJson: json(target.snapshot), afterJson: json(afterSnapshot), metadataJson: { requestId: input.requestId, payloadHash, projectId: input.projectId, assessmentRoundId: target.round.id,
        evaluatorTeacherId: target.evaluator.id, evaluatorUserId: target.evaluator.userId, recordedByUserId: input.actorUserId,
        entryMethod: "ADMIN_FROM_EXTERNALLY_CONFIRMED_RESULTS", expectedVersion: input.expectedVersion, rawTotalScore, latePenaltyPercent: penalty ? 10 : 0 } } });
    await hooks.fault?.("after_audit");
    await tx.projectTimelineEvent.create({ data: { projectId: input.projectId, actorUserId: input.actorUserId,
      eventType: "ADMIN_I_SCORE_RECORDED", eventTitle: "ผู้ดูแลระบบบันทึกคะแนนสะสาง I ตามผลประเมินที่ยืนยันแล้ว", eventDescription: input.comment,
      relatedEntityType: "ScoreSubmission", relatedEntityId: submission.id,
      metadataJson: { evaluatorTeacherId: target.evaluator.id, recordedByUserId: input.actorUserId, requestId: input.requestId, rawTotalScore, totalScore } } });
    if (target.round.roundType === "FINAL_PRESENTATION" && target.project.status === "IN_PROGRESS") {
      const committee = target.project.committeeAssignments.filter(a => a.active && ["HEAD", "MEMBER"].includes(a.role));
      const evidence = await tx.evaluatorAssignment.findMany({ where: { assessmentAttemptId: attempt.id }, select: { teacherId: true, scoreSubmission: { select: { status: true } } } });
      const distinctRoles = committee.some(a => a.role === "HEAD") && committee.some(a => a.role === "MEMBER") && new Set(committee.map(a => a.teacherId)).size >= 2;
      if (distinctRoles && isPresentationAssessmentComplete({ committeeAssignments: committee, scoreSubmissions: evidence.map(e => ({ teacherId: e.teacherId, status: e.scoreSubmission?.status })) })) {
        await tx.project.update({ where: { id: input.projectId }, data: { status: "FINAL_DONE" } });
        await tx.projectStatusHistory.create({ data: { projectId: input.projectId, fromStatus: "IN_PROGRESS", toStatus: "FINAL_DONE", actorUserId: input.actorUserId, reason: "ADMIN_RECORDED_CONFIRMED_FINAL_ASSESSMENTS", metadataJson: { requestId: input.requestId } } });
      }
    }
    await hooks.fault?.("after_final_state");
    return { unchanged: false };
  }, { isolationLevel: "Serializable", timeout: 20000 }));
}

export async function loadAdminAdvisorTarget(db: Reader, target: Target) {
  const result = await context(db, target);
  const assigned = result.project.committeeAssignments.some(a => a.active && a.role === "ADVISOR" && a.teacherId === result.evaluator.id)
    || result.project.advisorRequests.some(a => a.status === "APPROVED" && a.advisorTeacherId === result.evaluator.id);
  const external = await loadExternalEvidence(db, target.projectId);
  if (!assigned || (!external.valid && !["REPORT_APPROVED", "ADVISOR_SCORING"].includes(result.project.status)) || result.project.status === "COMPLETED") throw new AdminIScoreError("advisor_not_ready", "คะแนนที่ปรึกษาต้องตรงกับที่ปรึกษา และมีผลรายงานผ่านในระบบหรือแอดมินตรวจรับรองเอกสารจริงแล้ว");
  const previous = await db.advisorScore.findUnique({ where: { projectId: target.projectId } });
  if (previous && previous.advisorTeacherId !== result.evaluator.id) throw new AdminIScoreError("advisor_identity_changed", "ผู้ประเมินคะแนนเดิมต่างจากที่ปรึกษาปัจจุบัน ต้องตรวจประวัติก่อน ไม่แทนที่คะแนนเดิมอัตโนมัติ");
  return { ...result, previous, version: await version(db, "AdvisorScore", previous?.id, { projectId: target.projectId, evaluatorTeacherId: target.evaluatorTeacherId, previous }) };
}
export async function recordAdminAdvisorScore(db: Db, input: AdminAdvisorInput, hooks: Hooks = {}) {
  checkSubmission(input);
  if (validateAdvisorScore(input.marks).length || Object.keys(input.marks).length !== advisorCriteria.length) throw new AdminIScoreError("marks_invalid", "กรอกคะแนนที่ปรึกษาให้ครบตามเกณฑ์เดิม");
  const payloadHash = digest(input);
  return retryScoreTransaction(() => db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"admin-i-entry:" + input.requestId}))::text`;
    await tx.$queryRaw`SELECT co.id FROM course_offerings co JOIN projects p ON p.course_offering_id=co.id WHERE p.id=${input.projectId} FOR SHARE OF co`;
    await tx.$queryRaw`SELECT id FROM projects WHERE id=${input.projectId} FOR UPDATE`;
    const target = await loadAdminAdvisorTarget(tx, input);
    if (await replay(tx, input.requestId, input.actorUserId, payloadHash)) return { unchanged: true };
    if (target.version !== input.expectedVersion) throw new AdminIScoreError("version_conflict", "คะแนนเปลี่ยนแล้ว กรุณาตรวจค่าปัจจุบันก่อนบันทึกใหม่");
    const now = new Date(), score = totalAdvisorScore(input.marks);
    const values = { advisorTeacherId: target.evaluator.id, score, responsibilityScore: input.marks.responsibility,
      researchProcessScore: input.marks.researchProcess, problemSolvingScore: input.marks.problemSolving,
      communicationScore: input.marks.communication, professionalismScore: input.marks.professionalism,
      comment: input.comment, status: "SUBMITTED" as const, reportClosedAt: target.previous?.reportClosedAt ?? now, unlockedAt: target.previous?.unlockedAt ?? now, submittedAt: now };
    const saved = await tx.advisorScore.upsert({ where: { projectId: input.projectId }, update: values, create: { projectId: input.projectId, ...values } });
    await hooks.fault?.("after_submission");
    if (target.project.status === "REPORT_APPROVED") {
      await tx.project.update({ where: { id: input.projectId }, data: { status: "ADVISOR_SCORING" } });
      await tx.projectStatusHistory.create({ data: { projectId: input.projectId, fromStatus: "REPORT_APPROVED", toStatus: "ADVISOR_SCORING", actorUserId: input.actorUserId, reason: "ADMIN_RECORDED_CONFIRMED_ADVISOR_ASSESSMENT" } });
    }
    await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action, entityType: "AdvisorScore", entityId: saved.id,
      beforeJson: json(target.previous), afterJson: json(saved), metadataJson: { requestId: input.requestId, payloadHash, projectId: input.projectId,
        evaluatorTeacherId: target.evaluator.id, recordedByUserId: input.actorUserId, entryMethod: "ADMIN_FROM_EXTERNALLY_CONFIRMED_RESULTS", expectedVersion: input.expectedVersion } } });
    await hooks.fault?.("after_audit");
    await tx.projectTimelineEvent.create({ data: { projectId: input.projectId, actorUserId: input.actorUserId, eventType: "ADMIN_I_ADVISOR_SCORE_RECORDED",
      eventTitle: "ผู้ดูแลระบบบันทึกคะแนนที่ปรึกษาสำหรับสะสาง I", relatedEntityType: "AdvisorScore", relatedEntityId: saved.id,
      metadataJson: { evaluatorTeacherId: target.evaluator.id, recordedByUserId: input.actorUserId, score, requestId: input.requestId } } });
    return { unchanged: false };
  }, { isolationLevel: "Serializable", timeout: 20000 }));
}
