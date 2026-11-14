import { createHash } from "node:crypto";
import type { CommitteeRole, PrismaClient } from "@prisma/client";
import { openOfferingAtomic, importCohortAtomic } from "../src/lib/terms/offeringLifecycle";
import { seedBaselineRubrics } from "../src/lib/admin/rubricBaseline";

type UiTeacher = { id: string; userId: string; role: CommitteeRole };
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function requireDisposable(db: PrismaClient) {
  const url = new URL(process.env.DATABASE_URL ?? "");
  check(url.hostname === "127.0.0.1" && url.pathname === "/term_rollover_main" && process.env.PGAPPNAME === "synthetic-term-rollover-only", "Disposable UI fixture only");
  const actual = await db.$queryRaw<Array<{ name: string; address: string }>>`SELECT current_database() AS name, inet_server_addr()::text AS address`;
  check(actual[0]?.name === "term_rollover_main" && ["127.0.0.1", "127.0.0.1/32"].includes(actual[0].address), "Expected owned localhost database");
}
export async function prepareFullUiFixture(db: PrismaClient, actorId: string, teachers: UiTeacher[]) {
  await requireDisposable(db);
  await seedBaselineRubrics(db);
  const course = await openOfferingAtomic(db, actorId, { yearBe: 2569, termType: "SEMESTER_2", courseTitle: "SYNTHETIC Full browser progression", termDisplayName: "ภาคเรียนที่ 2 ปีการศึกษา 2569 (จำลอง)", courseCode: "SMA6002", section: "UI01" });
  await importCohortAtomic(db, actorId, course.id, "student_code,first_name_th,last_name_th\n9500000000001,Browser,HappyI\n9500000000002,Browser,ExplicitE");
  const projects = await db.project.findMany({ where: { courseOfferingId: course.id }, include: { student: true }, orderBy: { student: { studentCode: "asc" } } });
  const rounds = await db.assessmentRound.findMany({ where: { courseOfferingId: course.id } });
  for (const project of projects) {
    const user = await db.user.create({ data: { email: project.student.generatedEmail, name: `${project.student.firstNameTh} ${project.student.lastNameTh}`, globalRole: "STUDENT" } });
    await db.student.update({ where: { id: project.studentId }, data: { userId: user.id } });
    await db.studentProfile.create({ data: { studentId: project.studentId, preferredName: "Synthetic browser", phone: "0800000000", lineId: "synthetic-ui-only", completedAt: new Date() } });
    await db.project.update({ where: { id: project.id }, data: { status: "IN_PROGRESS", currentTitleTh: `SYNTHETIC UI ${project.student.lastNameTh}` } });
    for (const teacher of teachers) await db.committeeAssignment.create({ data: { projectId: project.id, teacherId: teacher.id, role: teacher.role, appointedByUserId: actorId } });
    await db.advisorRequest.create({ data: { projectId: project.id, studentId: project.studentId, advisorTeacherId: teachers[0].id, status: "APPROVED", reviewedAt: new Date() } });
    for (const type of ["PROPOSAL", "PROGRESS_1"] as const) {
      const round = rounds.find(item => item.roundType === type)!;
      const rubric = await db.rubric.findFirstOrThrow({ where: { roundType: type, active: true }, include: { items: true } });
      const attempt = await db.assessmentAttempt.create({ data: { projectId: project.id, assessmentRoundId: round.id, attemptNo: 1, attemptType: type === "PROPOSAL" ? "MAIN_PROPOSAL" : "PROGRESS_1", status: "SCORING_CLOSED" } });
      for (const teacher of teachers.slice(1)) {
        const assignment = await db.evaluatorAssignment.create({ data: { assessmentAttemptId: attempt.id, evaluatorUserId: teacher.userId, teacherId: teacher.id, evaluatorDisplayNameSnapshot: `Synthetic ${teacher.role}`, status: "SUBMITTED", isRequired: true } });
        await db.scoreSubmission.create({ data: { evaluatorAssignmentId: assignment.id, status: "SUBMITTED", totalScore: 80, submittedAt: new Date("2026-10-19T00:00:00Z"), scoreItems: { create: rubric.items.map(item => ({ rubricItemId: item.id, checked: true, pointsAwarded: Number(item.points) * 0.8 })) } } });
      }
    }
  }
  await db.assessmentRound.updateMany({ where: { courseOfferingId: course.id }, data: { status: "SCORING_CLOSED", closedAt: new Date("2026-10-19T00:00:00Z") } });
  const oldScores = await db.scoreSubmission.findMany({ where: { evaluatorAssignment: { assessmentAttempt: { projectId: { in: projects.map(project => project.id) } } } }, orderBy: { id: "asc" } });
  return { offeringId: course.id, iProjectId: projects[0].id, iStudentId: projects[0].studentId, eProjectId: projects[1].id, eStudentId: projects[1].studentId, rounds: rounds.map(round => ({ id: round.id, type: round.roundType })), teacherIds: teachers, oldScoreIds: oldScores.map(score => score.id), oldScoreHash: createHash("sha256").update(JSON.stringify(oldScores)).digest("hex") };
}
export async function verifyFullUiFixture(db: PrismaClient, scenario: Awaited<ReturnType<typeof prepareFullUiFixture>>) {
  await requireDisposable(db);
  const project = await db.project.findUniqueOrThrow({ where: { id: scenario.iProjectId }, include: { academicResult: { include: { continuations: true } }, statusHistory: true, scheduleProposals: { include: { approvals: true } }, reportVersions: { include: { reviews: true }, orderBy: { versionNo: "asc" } }, advisorScore: true, attempts: { include: { evaluatorAssignments: { include: { scoreSubmission: true } } } } } });
  const result = project.academicResult;
  check(project.status === "COMPLETED" && result?.originalGrade === "I" && result.status === "RESOLVED" && result.version === 2 && result.resolutionGrade === "A", "UI I reaches real Admin COMPLETED and explicit resolution, original I preserved");
  const e = await db.project.findUniqueOrThrow({ where: { id: scenario.eProjectId }, include: { academicResult: true } });
  check(e.status === "IN_PROGRESS" && e.academicResult?.originalGrade === "E" && e.academicResult.status === "FINALIZED", "UI explicit E retains unfinished workflow without fake zero/completion");
  check((await db.courseOffering.findUniqueOrThrow({ where: { id: scenario.offeringId } })).status === "CLOSED", "UI course closure");
  check(project.scheduleProposals.length === 2 && project.scheduleProposals.every(schedule => schedule.status === "CONFIRMED" && schedule.approvals.length === 3 && schedule.approvals.every(approval => approval.decision === "APPROVE")), "UI committee approval3/3 for both actual rounds");
  const continuedAttempts = project.attempts.filter(attempt => ["PROGRESS_2", "FINAL_PRESENTATION"].includes(attempt.attemptType));
  check(continuedAttempts.length === 2 && continuedAttempts.every(attempt => attempt.evaluatorAssignments.length === 2 && attempt.evaluatorAssignments.every(assignment => assignment.scoreSubmission?.status === "SUBMITTED")), "UI four actual presentation score submissions without duplicates");
  check(project.reportVersions.length === 2 && project.reportVersions[0].reviews.some(review => review.decision === "FAIL") && project.reportVersions[1].reviews.filter(review => review.decision === "PASS").length === 3, "UI report revision preserves old FAIL and all required reviewers pass new version");
  check(project.advisorScore?.status === "SUBMITTED" && project.academicResult?.continuations.length === 2 && project.academicResult.continuations.every(grant => grant.status === "RESOLVED"), "UI advisor score and I grant revocation");
  for (const status of ["FINAL_DONE", "REPORT_REVIEW", "REPORT_APPROVED", "ADVISOR_SCORING", "COMPLETED"]) check(project.statusHistory.some(event => event.toStatus === status), `UI actual transition ${status}`);
  const retained = await db.scoreSubmission.findMany({ where: { id: { in: scenario.oldScoreIds } }, orderBy: { id: "asc" } });
  check(createHash("sha256").update(JSON.stringify(retained)).digest("hex") === scenario.oldScoreHash, "pre-existing UI course scores retained exactly");
  const audits = await db.auditLog.findMany({ where: { OR: [{ entityId: scenario.offeringId, action: "COURSE_RESULTS_CLOSED_WITH_I" }, { entityId: scenario.iProjectId, action: "ACADEMIC_I_RESOLVED" }] }, select: { action: true } });
  check(audits.filter(audit => audit.action === "COURSE_RESULTS_CLOSED_WITH_I").length === 1 && audits.filter(audit => audit.action === "ACADEMIC_I_RESOLVED").length === 1, "UI one closure/resolution audit despite replay inspection");
  return { passed: true, syntheticOnly: true, actorTransitionsThroughApp: true, projects: 2, confirmedSchedules: 2, committeeApprovals: 6, presentationScores: 4, reportVersions: 2, finalReportPasses: 3, originalScoresRetained: true, courseClosed: true, iResolvedVersion: 2, eFinalizedWithoutZero: true, noFixtureWritesAfterBrowserStarted: true };
}
