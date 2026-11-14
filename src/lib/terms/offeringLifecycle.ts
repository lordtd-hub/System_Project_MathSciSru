import { AcademicWorkflowError } from "./errors";
import { retryScoreTransaction } from "@/lib/scoring/transactionRetry";
import type { PrismaClient, TermType } from "@prisma/client";
import { courseLevelRoundTypes, defaultCourseRoundName, defaultCourseRoundWeight } from "@/lib/assessments/courseRounds";
import { generatedStudentEmail, hasImportErrors, validateStudentImportRows } from "@/lib/validators/studentImport";
import { parseStudentImportCsv } from "@/lib/admin/studentImportCsv";

type Db = Pick<PrismaClient, "$transaction">;
export async function openOfferingAtomic(db: Db, actorId: string, input: {
  yearBe: number; termType: TermType; courseTitle: string; termDisplayName: string; courseCode: string | null; section: string | null;
}) {
  return retryScoreTransaction(() => db.$transaction(async tx => {
    const actor = await tx.user.findUnique({ where: { id: actorId }, select: { active: true, globalRole: true } });
    if (!actor?.active || actor.globalRole !== "ADMIN") throw new AcademicWorkflowError("ไม่อนุญาต");
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`offering:${input.yearBe}:${input.termType}`}))::text`;
    const year = await tx.academicYear.upsert({ where: { yearBe: input.yearBe }, update: {}, create: { yearBe: input.yearBe } });
    const previousTerm = await tx.term.findUnique({ where: { academicYearId_termType: { academicYearId: year.id, termType: input.termType } } });
    if (previousTerm?.status === "CLOSED") throw new AcademicWorkflowError("ภาคเรียนปิดผลแล้ว ต้องตรวจข้อมูลก่อนเปิดใหม่");
    const term = previousTerm ?? await tx.term.create({ data: { academicYearId: year.id, termType: input.termType, displayName: input.termDisplayName, status: "ACTIVE" } });
    const existing = await tx.courseOffering.findFirst({ where: { termId: term.id, ...(input.courseCode
      ? { courseCode: input.courseCode, section: input.section } : { courseTitle: input.courseTitle, courseCode: null, section: null }) } });
    if (existing) {
      if (existing.status === "CLOSED") throw new AcademicWorkflowError("รายวิชาปิดผลแล้ว ไม่เปิดซ้ำอัตโนมัติ");
      return { id: existing.id, unchanged: true };
    }
    const offering = await tx.courseOffering.create({ data: { termId: term.id, courseTitle: input.courseTitle, courseCode: input.courseCode, section: input.section, status: "ACTIVE" } });
    for (const roundType of courseLevelRoundTypes) await tx.assessmentRound.create({ data: {
      courseOfferingId: offering.id, roundType, name: defaultCourseRoundName(roundType), courseWeight: defaultCourseRoundWeight(roundType), rawScoreMax: 100
    } });
    await tx.auditLog.create({ data: { actorUserId: actorId, action: "COURSE_OFFERING_OPENED", entityType: "CourseOffering", entityId: offering.id,
      afterJson: { yearBe: input.yearBe, termType: input.termType, courseCode: input.courseCode, section: input.section, courseTitle: input.courseTitle } } });
    return { id: offering.id, unchanged: false };
  }, { isolationLevel: "Serializable", timeout: 20000 }));
}

export async function importCohortAtomic(db: Db, actorId: string, offeringId: string, csv: string) {
  const parsed = parseStudentImportCsv(csv);
  if (!parsed.ok) throw new AcademicWorkflowError(parsed.error);
  const validated = validateStudentImportRows(parsed.rows, new Set<string>(), new Set<string>());
  if (!validated.length || hasImportErrors(validated)) throw new AcademicWorkflowError("รายชื่อนำเข้าไม่ถูกต้อง กรุณาตรวจรหัสซ้ำและชื่อ");
  return retryScoreTransaction(() => db.$transaction(async tx => {
    const actor = await tx.user.findUnique({ where: { id: actorId }, select: { active: true, globalRole: true } });
    if (!actor?.active || actor.globalRole !== "ADMIN") throw new AcademicWorkflowError("ไม่อนุญาต");
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM course_offerings WHERE id=${offeringId} FOR UPDATE`;
    if (!locked.length) throw new AcademicWorkflowError("ไม่พบรายวิชา");
    const offering = await tx.courseOffering.findUniqueOrThrow({ where: { id: offeringId } });
    if (offering.status !== "ACTIVE") throw new AcademicWorkflowError("นำเข้าได้เฉพาะรายวิชาที่เปิดอยู่");
    let createdProjects = 0;
    for (const row of validated) {
      const email = generatedStudentEmail(row.student_code);
      const existing = await tx.student.findUnique({ where: { studentCode: row.student_code } });
      if (existing && (existing.generatedEmail !== email || existing.firstNameTh !== row.first_name_th || existing.lastNameTh !== row.last_name_th || !existing.active)) {
        throw new AcademicWorkflowError(`ข้อมูลประจำตัว ${row.student_code} ไม่ตรง ต้องตรวจแยกก่อนนำเข้า ไม่แก้ประวัติเดิมอัตโนมัติ`);
      }
      const student = existing ?? await tx.student.create({ data: { studentCode: row.student_code, firstNameTh: row.first_name_th, lastNameTh: row.last_name_th, generatedEmail: email } });
      const project = await tx.project.findUnique({ where: { courseOfferingId_studentId: { courseOfferingId: offeringId, studentId: student.id } }, select: { id: true } });
      if (!project) {
        await tx.project.create({ data: { courseOfferingId: offeringId, studentId: student.id, status: "STUDENT_PROFILE" } });
        createdProjects++;
      }
    }
    if (createdProjects) await tx.auditLog.create({ data: { actorUserId: actorId, action: "STUDENT_IMPORT", entityType: "CourseOffering", entityId: offeringId,
      afterJson: { importedCount: createdProjects, reviewedStudentCodes: validated.map(row => row.student_code), preservesExistingProjects: true } } });
    return { createdProjects, unchanged: createdProjects === 0 };
  }, { isolationLevel: "Serializable", timeout: 20000 }));
}
