import { randomUUID } from "node:crypto";
import type { CommitteeRole, PrismaClient } from "@prisma/client";
import { openOfferingAtomic, importCohortAtomic } from "../src/lib/terms/offeringLifecycle";
import { closeOfferingWithIncomplete } from "../src/lib/terms/incomplete";
import { loadAdminPresentationTarget, recordAdminPresentationScore, loadAdminAdvisorTarget, recordAdminAdvisorScore } from "../src/lib/scoring/adminClosedIScore";
import { persistPresentationScore } from "../src/lib/scoring/persistPresentationScore";
import { saveStudentProfileAtomic } from "../src/lib/projects/studentCurrentStageMutations";
import { submitReportVersionAtomic } from "../src/lib/projects/studentFutureStageMutations";
import { advisorHistoryWhere } from "../src/lib/projects/history";
import { canViewProjectRecord } from "../src/lib/projects/projectRecord";

function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function rejects(operation: () => Promise<unknown>, message: string) { let denied = false; try { await operation(); } catch { denied = true; } check(denied, message); }
const csv = (rows: string[]) => "student_code,first_name_th,last_name_th\n" + rows.join("\n");
export async function runAdminICases(db: PrismaClient, pass: (value: string) => void) {
  const admin = await db.user.create({ data: { email: "synthetic.owner@sru.ac.th", name: "Synthetic Owner", globalRole: "ADMIN" } });
  const teachers = [];
  for (const role of ["ADVISOR", "HEAD", "MEMBER"] as CommitteeRole[]) {
    const user = await db.user.create({ data: { email: `synthetic.${role.toLowerCase()}@sru.ac.th`, name: `Synthetic ${role}`, globalRole: "TEACHER" } });
    const teacher = await db.teacher.create({ data: { userId: user.id, academicPrefix: "Synthetic ", firstNameTh: role, lastNameTh: "Only", email: user.email } });
    teachers.push({ ...teacher, role });
  }
  const faculty = teachers[1];
  const outsider = await db.teacher.create({ data: { academicPrefix: "Synthetic ", firstNameTh: "Unassigned", lastNameTh: "Only" } });
  const input = (section: string, termType: "SEMESTER_1" | "SEMESTER_2" = "SEMESTER_2") => ({ yearBe: 2569, termType, courseCode: "SMA6002", section, courseTitle: "Synthetic project course", termDisplayName: `${termType === "SEMESTER_1" ? "1" : "2"}/2569 (จำลอง)` });
  const old = await openOfferingAtomic(db, admin.id, input("N01", "SEMESTER_1"));
  await rejects(() => openOfferingAtomic(db, admin.id, input("P01")), "cannot open while old ACTIVE");
  await rejects(() => openOfferingAtomic(db, faculty.userId!, input("P01")), "faculty cannot activate");
  check(await db.courseOffering.count() === 1 && await db.academicYear.count() === 1 && await db.term.count() === 1, "failed activation rolls back all created year/term rows");
  await importCohortAtomic(db, admin.id, old.id, csv(["9900000000001,Synthetic,One", "9900000000002,Synthetic,Two"]));
  const projects = await db.project.findMany({ where: { courseOfferingId: old.id }, include: { student: true }, orderBy: { student: { studentCode: "asc" } } });
  const owner = projects[0], preserved = projects[1];
  for (const project of projects) {
    await db.project.update({ where: { id: project.id }, data: { status: "IN_PROGRESS", currentTitleTh: "Synthetic " + project.student.studentCode } });
    for (const teacher of teachers) await db.committeeAssignment.create({ data: { projectId: project.id, teacherId: teacher.id, role: teacher.role, appointedByUserId: admin.id } });
  }
  const studentUser = await db.user.create({ data: { email: owner.student.generatedEmail, name: "Synthetic Student", globalRole: "STUDENT" } });
  await db.student.update({ where: { id: owner.studentId }, data: { userId: studentUser.id } });
  const context = { userId: studentUser.id, studentId: owner.studentId, projectId: owner.id, studentCode: owner.student.studentCode, studentFirstNameTh: "Synthetic", studentLastNameTh: "One" };
  const rounds = await db.assessmentRound.findMany({ where: { courseOfferingId: old.id } });
  const p2 = rounds.find(r => r.roundType === "PROGRESS_2")!, final = rounds.find(r => r.roundType === "FINAL_PRESENTATION")!;
  for (const roundType of ["PROGRESS_2", "FINAL_PRESENTATION"] as const) await db.rubric.create({ data: { roundType, name: "Synthetic legacy rubric", items: { create: [
    { groupKey: "s", groupLabelTh: "Synthetic", itemKey: "synthetic-a", itemLabelTh: "Synthetic criterion A", points: 40, displayOrder: 1 },
    { groupKey: "s", groupLabelTh: "Synthetic", itemKey: "synthetic-b", itemLabelTh: "Synthetic criterion B", points: 60, displayOrder: 2 }
  ] } } });
  const preservedAttempt = await db.assessmentAttempt.create({ data: { projectId: preserved.id, assessmentRoundId: p2.id, attemptNo: 1, attemptType: "PROGRESS_2", status: "SCORING_CLOSED" } });
  const preservedAssignment = await db.evaluatorAssignment.create({ data: { assessmentAttemptId: preservedAttempt.id, teacherId: faculty.id, evaluatorUserId: faculty.userId!, evaluatorDisplayNameSnapshot: "Synthetic HEAD", isRequired: true } });
  await db.scoreSubmission.create({ data: { evaluatorAssignmentId: preservedAssignment.id, totalScore: 72, status: "SUBMITTED", submittedAt: new Date("2026-10-08T00:00:00Z") } });
  const untouched = () => db.project.findUnique({ where: { id: preserved.id }, include: { attempts: { include: { evaluatorAssignments: { include: { scoreSubmission: true } } } }, committeeAssignments: { orderBy: { id: "asc" } } } });
  const retained = JSON.stringify(await untouched());
  const closing = { actorId: admin.id, offeringId: old.id, expectedProjectIds: projects.map(p => p.id), decisions: projects.map(p => ({ projectId: p.id, grade: "I" as const, reason: "Synthetic externally confirmed incomplete" })), reason: "Synthetic term closed", reference: "Synthetic test only" };
  await closeOfferingWithIncomplete(db, closing);
  check((await closeOfferingWithIncomplete(db, closing)).unchanged, "close replay is idempotent");
  pass("ACTIVE guard denies faculty/open-before-close; failed opening is atomic; course I closure/replay preserves actual scores");

  const raced = await Promise.allSettled(["P01", "Q01", "R01"].map(section => openOfferingAtomic(db, admin.id, input(section))));
  check(raced.filter(r => r.status === "fulfilled").length === 1, "one winner among concurrent different offerings");
  check(await db.courseOffering.count({ where: { status: "ACTIVE" } }) === 1, "exactly one ACTIVE under concurrency");
  const current = await db.courseOffering.findFirstOrThrow({ where: { status: "ACTIVE" } });
  const same = await Promise.all(Array.from({ length: 3 }, () => openOfferingAtomic(db, admin.id, input(current.section!))));
  check(same.every(r => r.unchanged && r.id === current.id), "duplicate activation is idempotent");
  await rejects(() => db.courseOffering.create({ data: { termId: current.termId, courseTitle: "Synthetic bypass", courseCode: "SYNTH", section: "X", status: "ACTIVE" } }), "DB partial index blocks direct legacy writer");
  const draft = await db.courseOffering.create({ data: { termId: current.termId, courseTitle: "Synthetic draft", courseCode: "SYNTH", section: "D", status: "DRAFT" } });
  await rejects(() => db.courseOffering.update({ where: { id: draft.id }, data: { status: "ACTIVE" } }), "DB index blocks direct activation race");
  check((await db.courseOffering.findUniqueOrThrow({ where: { id: old.id } })).status === "CLOSED", "no automatic reopening of old course");
  pass("concurrent create/activate has one ACTIVE winner; duplicate requests idempotent; raw legacy writes cannot bypass DB invariant; no auto-close");
  // Close an empty ACTIVE course through the real service, then activate a DRAFT sibling.
  await closeOfferingWithIncomplete(db, { actorId: admin.id, offeringId: current.id, expectedProjectIds: [], decisions: [], reason: "Synthetic empty course close", reference: "Synthetic no enrollment" });
  const activated = await openOfferingAtomic(db, admin.id, { ...input("D"), courseCode: "SYNTH", courseTitle: "Synthetic draft" });
  check(activated.id === draft.id, "DRAFT activation retains course identity");
  const newOffering = await db.courseOffering.findUniqueOrThrow({ where: { id: draft.id } });
  const firstCsv = csv(["9800000000001,Synthetic,NewOne"]), secondCsv = csv(["9800000000001,Synthetic,NewOne", "9800000000002,Synthetic,NewTwo"]);
  check((await importCohortAtomic(db, admin.id, newOffering.id, firstCsv)).createdProjects === 1, "first import");
  const beforeLate = await db.project.findFirstOrThrow({ where: { courseOfferingId: newOffering.id } });
  check((await importCohortAtomic(db, admin.id, newOffering.id, secondCsv)).createdProjects === 1, "later import adds only new enrollment");
  check((await importCohortAtomic(db, admin.id, newOffering.id, secondCsv)).unchanged, "late import replay no duplicates");
  check(JSON.stringify(await db.project.findUnique({ where: { id: beforeLate.id } })) === JSON.stringify(beforeLate), "earlier imported project unchanged");
  await importCohortAtomic(db, admin.id, newOffering.id, csv(["9900000000001,Synthetic,One"]));
  check(await db.project.count({ where: { studentId: owner.studentId } }) === 2, "same student retains separate projects across terms");
  await rejects(() => importCohortAtomic(db, faculty.userId!, newOffering.id, firstCsv), "faculty import denied");
  await rejects(() => importCohortAtomic(db, admin.id, old.id, firstCsv), "closed import denied");
  pass("empty course can explicitly close; DRAFT activation preserves ID; later imports/new/duplicate/cross-term/permission cases retain earlier projects");

  const make = async (teacherId: string, roundId = p2.id, points = [40, 60]) => {
    const target = await loadAdminPresentationTarget(db, { actorUserId: admin.id, projectId: owner.id, evaluatorTeacherId: teacherId, assessmentRoundId: roundId });
    return { actorUserId: admin.id, projectId: owner.id, evaluatorTeacherId: teacherId, assessmentRoundId: roundId, requestId: randomUUID(), expectedVersion: target.version, items: target.rubric.items.map((i, index) => ({ id: i.id, points: points[index] })), comment: null };
  };
  const original = await make(faculty.id);
  const writeState = async () => JSON.stringify(await db.project.findUnique({ where: { id: owner.id }, include: { attempts: { orderBy: { id: "asc" }, include: { evaluatorAssignments: { orderBy: { id: "asc" }, include: { scoreSubmission: { include: { scoreItems: { orderBy: { id: "asc" } } } } } } } }, timelineEvents: { orderBy: { id: "asc" } }, statusHistory: { orderBy: { id: "asc" } } } }));
  for (const point of ["after_assignment", "after_submission", "after_items", "after_audit", "after_final_state"]) {
    const before = await writeState(), audits = await db.auditLog.count();
    await rejects(() => recordAdminPresentationScore(db, { ...original, requestId: randomUUID() }, { fault: at => { if (at === point) throw Error("Synthetic rollback fault"); } }), "fault must abort");
    check(await writeState() === before && await db.auditLog.count() === audits, "every write rolls back at " + point);
  }
  for (const invalid of [
    { ...original, actorUserId: faculty.userId! }, { ...original, actorUserId: studentUser.id },
    { ...original, evaluatorTeacherId: outsider.id }, { ...original, evaluatorTeacherId: teachers[0].id },
    { ...original, expectedVersion: "0".repeat(64) }, { ...original, items: original.items.slice(1) },
    { ...original, items: original.items.map(i => ({ ...i, points: -1 })) },
    { ...original, items: original.items.map(i => ({ ...i, points: Number.NaN })) },
    { ...original, items: [original.items[0], original.items[0]] }
  ]) await rejects(() => recordAdminPresentationScore(db, invalid), "invalid closed-I score denied");
  const foreignRound = await db.assessmentRound.findFirstOrThrow({ where: { courseOfferingId: newOffering.id } });
  await rejects(() => recordAdminPresentationScore(db, { ...original, assessmentRoundId: foreignRound.id }), "cross-course round denied");
  const targetOther = await make(teachers[2].id);
  check(original.expectedVersion !== targetOther.expectedVersion, "version binds actual evaluator target");
  await rejects(() => recordAdminPresentationScore(db, { ...targetOther, expectedVersion: original.expectedVersion }), "cross-tab evaluator token denied");
  check(!(await recordAdminPresentationScore(db, original)).unchanged, "initial admin entry");
  check((await recordAdminPresentationScore(db, original)).unchanged, "same request replay exactly once");
  await rejects(() => recordAdminPresentationScore(db, { ...original, items: original.items.map(i => ({ ...i, points: 10 })) }), "same nonce different payload denied");
  await rejects(() => recordAdminPresentationScore(db, { ...original, requestId: randomUUID() }), "stale score version denied");
  const audits = await db.auditLog.findMany({ where: { action: "ADMIN_CLOSED_I_SCORE_RECORDED" } });
  check(audits.length === 1 && audits[0].actorUserId === admin.id && (audits[0].metadataJson as Record<string, unknown>).evaluatorTeacherId === faculty.id, "recorder distinct from evaluator");
  check((await db.evaluatorAssignment.findFirstOrThrow({ where: { assessmentAttempt: { projectId: owner.id } } })).evaluatorUserId === faculty.userId, "actual evaluator identity retained");
  pass("admin I entry rejects role/course/evaluator/blank/invalid/stale/cross-tab targets; all five fault positions roll back; replay audited exactly once with separate evaluator/recorder");
  const concurrent = await make(faculty.id, p2.id, [0, 60]);
  const results = await Promise.allSettled([recordAdminPresentationScore(db, concurrent), recordAdminPresentationScore(db, { ...concurrent, requestId: randomUUID(), items: concurrent.items.map(i => ({ ...i, points: 0 })) })]);
  check(results.filter(r => r.status === "fulfilled").length === 1, "score race has one version winner");
  const finalHead = await make(faculty.id, final.id), finalMember = await make(teachers[2].id, final.id);
  await recordAdminPresentationScore(db, finalHead);
  check((await db.project.findUniqueOrThrow({ where: { id: owner.id } })).status === "IN_PROGRESS", "one final score does not complete exam");
  await recordAdminPresentationScore(db, finalMember);
  check((await db.project.findUniqueOrThrow({ where: { id: owner.id } })).status === "FINAL_DONE", "two actual committee evaluations allow FINAL_DONE only");
  check((await db.projectAcademicResult.findUniqueOrThrow({ where: { projectId: owner.id } })).status === "INCOMPLETE", "no auto resolution");
  pass("concurrent score edits use one version winner; Final waits for two real committee marks and never completes project or resolves I");
  await db.projectRoundException.create({ data: { projectId: owner.id, assessmentRoundId: p2.id, exceptionType: "LATE_ASSESSMENT_ROUND", reason: "Synthetic existing late rule", reopenedById: admin.id } });
  const penalized = await make(faculty.id, p2.id, [40, 60]);
  await recordAdminPresentationScore(db, penalized);
  const score = await db.scoreSubmission.findFirstOrThrow({ where: { evaluatorAssignment: { teacherId: faculty.id, assessmentAttempt: { projectId: owner.id, assessmentRoundId: p2.id } } } });
  check(Number(score.totalScore) === 90, "existing late penalty retained once");
  await db.projectRoundException.updateMany({ where: { projectId: owner.id, assessmentRoundId: p2.id }, data: { status: "RESOLVED", resolvedAt: new Date() } });
  const afterClosedFlag = await make(faculty.id, p2.id, [0, 60]);
  await recordAdminPresentationScore(db, afterClosedFlag);
  check(Number((await db.scoreSubmission.findUniqueOrThrow({ where: { id: score.id } })).totalScore) === 54, "closing exception cannot silently waive earlier ten percent");
  await rejects(() => persistPresentationScore({ requestId: randomUUID(), actorUserId: faculty.userId!, teacherId: faculty.id, evaluatorDisplayName: "Synthetic HEAD", projectId: owner.id, assessmentRoundId: p2.id, roundType: "PROGRESS_2", attemptType: "PROGRESS_2", assessmentKind: "PROGRESS_2", allowedProjectStatuses: ["IN_PROGRESS", "FINAL_DONE"], rawTotalScore: 80, overallComment: null, items: [], eventType: "test", createEventTitle: "test", updateEventTitle: "test", auditAction: "test" }), "faculty score direct service denied on closed I");
  await rejects(() => saveStudentProfileAtomic(db, context, { preferredName: "Changed", phone: null, lineId: null }), "student direct closed-I mutation denied");
  await rejects(() => submitReportVersionAtomic(db, context, { driveLink: "https://drive.google.com/file/d/synthetic/view", note: "Synthetic" }), "student old-I report mutation denied");
  pass("existing late policy applies once; actual faculty scoring and student profile/report services deny closed I direct writes");
  const related = await db.project.findUniqueOrThrow({ where: { id: owner.id }, include: { student: true, courseOffering: true, advisorRequests: true, committeeAssignments: true, scheduleProposals: { include: { approvals: true } }, attempts: { include: { evaluatorAssignments: true } }, reportVersions: { include: { reviews: true } }, advisorScore: true } });
  check(canViewProjectRecord(related, { role: "TEACHER", teacherId: teachers[0].id }).allowed, "own advisor history allowed");
  check(!canViewProjectRecord(related, { role: "TEACHER", teacherId: faculty.id }).allowed, "past head history denied");
  check(await db.project.count({ where: advisorHistoryWhere(faculty.id) }) === 0, "head cannot query advisor history");
  check(await db.project.count({ where: advisorHistoryWhere(teachers[0].id) }) === 2, "only own closed advisees found");
  pass("actual history queries allow former advisor only, deny old committee-only teacher; student-owned data retained");
  // Separate explicit fixture for already-approved report; no review or approval is manufactured by the entry service.
  await db.project.update({ where: { id: owner.id }, data: { status: "REPORT_APPROVED" } });
  const advisorTarget = await loadAdminAdvisorTarget(db, { actorUserId: admin.id, projectId: owner.id, evaluatorTeacherId: teachers[0].id });
  const advisor = { actorUserId: admin.id, projectId: owner.id, evaluatorTeacherId: teachers[0].id, requestId: randomUUID(), expectedVersion: advisorTarget.version,
    marks: { responsibility: 25, researchProcess: 25, problemSolving: 25, communication: 15, professionalism: 10 }, comment: null };
  for (const point of ["after_submission", "after_audit"]) await rejects(() => recordAdminAdvisorScore(db, { ...advisor, requestId: randomUUID() }, { fault: at => { if (at === point) throw Error("Synthetic advisor rollback"); } }), "advisor failure rollback");
  check(await db.advisorScore.count() === 0 && (await db.project.findUniqueOrThrow({ where: { id: owner.id } })).status === "REPORT_APPROVED", "advisor score and status rollback");
  await recordAdminAdvisorScore(db, advisor); check((await recordAdminAdvisorScore(db, advisor)).unchanged, "advisor replay");
  check(Number((await db.advisorScore.findUniqueOrThrow({ where: { projectId: owner.id } })).score) === 100, "original advisor raw100 unchanged");
  check((await db.project.findUniqueOrThrow({ where: { id: owner.id } })).status === "ADVISOR_SCORING" && (await db.projectAcademicResult.findUniqueOrThrow({ where: { projectId: owner.id } })).status === "INCOMPLETE", "no auto completed/resolution from advisor entry");
  check(JSON.stringify(await untouched()) === retained, "other original project and scores preserved");
  await db.user.update({ where: { id: admin.id }, data: { active: false } });
  await rejects(() => recordAdminAdvisorScore(db, advisor), "revoked actor cannot replay success");
  await db.user.update({ where: { id: admin.id }, data: { active: true } });
  pass("advisor entry preserves original criteria/raw100, fault rollback, idempotency and separate actor audit; no auto closeout/I resolution; revoked actor denied; unrelated old records unchanged");
  await db.committeeAssignment.create({ data: { projectId: beforeLate.id, teacherId: teachers[2].id, role: "ADVISOR", appointedByUserId: admin.id } });
  return { adminId: admin.id, teacherIds: teachers.map(t => ({ id: t.id, userId: t.userId, role: t.role })), oldOfferingId: old.id, newOfferingId: newOffering.id, activeProjectId: beforeLate.id, oldIProjectId: owner.id, oldIStudentId: owner.studentId, otherIProjectId: preserved.id, studentUserId: studentUser.id, p2RoundId: p2.id, finalRoundId: final.id };
}
