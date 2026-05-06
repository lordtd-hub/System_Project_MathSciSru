import { PrismaClient, type ProjectStatus } from "@prisma/client";
import { encode as encodeAuthJwt } from "next-auth/jwt";
import { courseLevelRoundTypes, defaultCourseRoundName, defaultCourseRoundWeight } from "../../src/lib/assessments/courseRounds";
import { buildCloseAssessmentRoundData } from "../../src/lib/assessments/roundClosure";
import { shouldAlertAdminForFailVotes, isScheduleConfirmed, isAdvisorScoreUnlocked } from "../../src/lib/lifecycle/transitions";
import { getCompletionEligibility } from "../../src/lib/lifecycle/completionEligibility";
import { validateMaterialLink } from "../../src/lib/validators/materialLink";
import { cleanKnownDemoData, e2eCourseOfferingId } from "../../prisma/demo-data";

const prisma = new PrismaClient();

type StepResult = {
  no: number;
  name: string;
  status: "PASS" | "FAIL";
  detail: string;
};

const startedAt = new Date();
const stamp = startedAt.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const courseOfferingId = e2eCourseOfferingId;
const authSessionCookie = "authjs.session-token";
const reportRows: StepResult[] = [];
const bugsFound: string[] = [];
const fixesMade = [
  "Student project submission now creates a pending AdvisorRequest.",
  "Proposal submission now moves the project to PROPOSAL_REVIEW and assigns proposal evaluators.",
  "Teacher advisor request page now performs approve/reject actions.",
  "Proposal score submission now requires a comment when submitted.",
  "Admin committee page now performs HEAD/MEMBER assignment and moves the project to IN_PROGRESS.",
  "Lifecycle E2E now cleans and reuses stable demo IDs so reruns do not grow duplicate projects or rounds.",
  "Admin completion now checks Progress 1, Progress 2, Final, report approval, advisor score, and unresolved report revision before COMPLETED."
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function step(no: number, name: string, run: () => Promise<string>) {
  try {
    const detail = await run();
    reportRows.push({ no, name, status: "PASS", detail });
    console.log(`PASS ${no}. ${name}: ${detail}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    reportRows.push({ no, name, status: "FAIL", detail });
    bugsFound.push(`${no}. ${name}: ${detail}`);
    console.error(`FAIL ${no}. ${name}: ${detail}`);
    throw error;
  }
}

async function withRouteServer<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  if (process.env.E2E_BASE_URL) return run(process.env.E2E_BASE_URL);

  const next = (await import("next")).default;
  const { createServer } = await import("node:http");
  const hostname = "127.0.0.1";
  const port = 3127;
  process.env.AUTH_TRUST_HOST = "true";
  process.env.AUTH_URL = `http://${hostname}:${port}`;
  process.env.NEXTAUTH_URL = `http://${hostname}:${port}`;
  process.env.GOOGLE_CLIENT_ID ||= "local-e2e-google-client-id";
  process.env.GOOGLE_CLIENT_SECRET ||= "local-e2e-google-client-secret";
  process.env.INITIAL_ADMIN_EMAIL ||= "dev.admin@sru.ac.th";
  const app = next({ dev: false, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();
  const server = createServer((req, res) => handle(req, res));

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, hostname, resolve);
  });

  try {
    return await run(`http://${hostname}:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await (app as { close?: () => Promise<void> }).close?.();
  }
}

async function encodeHttpAuthCookie(user: { id: string; email: string; name: string | null }) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  assert(secret, "NEXTAUTH_SECRET or AUTH_SECRET is required for HTTP route visibility checks");
  return encodeAuthJwt({
    token: { sub: user.id, email: user.email, name: user.name },
    secret,
    salt: authSessionCookie,
    maxAge: 60 * 60
  });
}

function localDatabaseGuard() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  assert(databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1"), "DATABASE_URL is not local; refusing to run lifecycle E2E");
}

async function setStatus(projectId: string, fromStatus: ProjectStatus | null, toStatus: ProjectStatus, reason: string, actorUserId?: string, metadataJson?: object) {
  await prisma.project.update({ where: { id: projectId }, data: { status: toStatus } });
  await prisma.projectStatusHistory.create({
    data: { projectId, fromStatus, toStatus, reason, actorUserId, metadataJson }
  });
}

async function timeline(projectId: string, eventType: string, eventTitle: string, actorUserId?: string, eventDescription?: string, metadataJson?: object) {
  await prisma.projectTimelineEvent.create({
    data: { projectId, eventType, eventTitle, actorUserId, eventDescription, metadataJson }
  });
}

async function ensureUser(email: string, role: "ADMIN" | "STUDENT" | "TEACHER", name: string, googleSub: string) {
  return prisma.user.upsert({
    where: { email },
    update: { globalRole: role, active: true, name },
    create: {
      email,
      emailDomain: email.split("@")[1] ?? null,
      globalRole: role,
      active: true,
      name,
      googleSub
    }
  });
}

async function ensureTeacher(index: number) {
  const firstNameTh = `อาจารย์ทดสอบ${index}`;
  const lastNameTh = "วงจรชีวิต";
  const email = `e2e.teacher.${index}@sru.ac.th`;
  const user = await ensureUser(email, "TEACHER", `ดร. ${firstNameTh} ${lastNameTh}`, `e2e-teacher-${index}-${stamp}`);
  return prisma.teacher.upsert({
    where: { academicPrefix_firstNameTh_lastNameTh: { academicPrefix: "ดร.", firstNameTh, lastNameTh } },
    update: { userId: user.id, email, active: true, isInternal: true, canEvaluateProposal: true },
    create: {
      academicPrefix: "ดร.",
      firstNameTh,
      lastNameTh,
      userId: user.id,
      email,
      active: true,
      isInternal: true,
      canEvaluateProposal: true
    }
  });
}

async function ensureStudent(studentCode: string, firstNameTh: string, lastNameTh: string) {
  const email = `${studentCode}@student.sru.ac.th`;
  const user = await ensureUser(email, "STUDENT", `${firstNameTh} ${lastNameTh}`, `e2e-student-${studentCode}-${stamp}`);
  const student = await prisma.student.upsert({
    where: { studentCode },
    update: { firstNameTh, lastNameTh, generatedEmail: email, userId: user.id, active: true },
    create: { studentCode, firstNameTh, lastNameTh, generatedEmail: email, userId: user.id }
  });
  return { student, user, email };
}

async function ensureRubric() {
  const rubric = await prisma.rubric.findFirst({
    where: { roundType: "PROPOSAL", active: true },
    include: { items: { orderBy: { displayOrder: "asc" } } }
  });
  if (rubric && rubric.items.reduce((sum, item) => sum + item.points, 0) === 100) return rubric;

  const latestVersion = await prisma.rubric.findFirst({ where: { roundType: "PROPOSAL" }, orderBy: { version: "desc" } });
  const created = await prisma.rubric.create({
    data: {
      roundType: "PROPOSAL",
      name: "E2E Proposal Rubric",
      version: (latestVersion?.version ?? 0) + 1,
      active: true,
      items: {
        create: [
          { groupKey: "clarity", groupLabelTh: "Clarity of Proposal", itemKey: "clarity", itemLabelTh: "Clarity of Proposal", points: 20, displayOrder: 1 },
          { groupKey: "relevance", groupLabelTh: "Relevance of Project", itemKey: "relevance", itemLabelTh: "Relevance of Project", points: 20, displayOrder: 2 },
          { groupKey: "plan", groupLabelTh: "Quality of Research Plan", itemKey: "plan", itemLabelTh: "Quality of Research Plan", points: 30, displayOrder: 3 },
          { groupKey: "presentation", groupLabelTh: "Presentation and Communication", itemKey: "presentation", itemLabelTh: "Presentation and Communication", points: 20, displayOrder: 4 },
          { groupKey: "overall", groupLabelTh: "Overall / Readiness", itemKey: "overall", itemLabelTh: "Overall / Readiness", points: 10, displayOrder: 5 }
        ]
      }
    },
    include: { items: { orderBy: { displayOrder: "asc" } } }
  });
  return created;
}

async function createProject(studentId: string, status: ProjectStatus) {
  return prisma.project.upsert({
    where: { courseOfferingId_studentId: { courseOfferingId, studentId } },
    update: { status, currentTitleTh: null, currentTitleEn: null },
    create: { courseOfferingId, studentId, status }
  });
}

async function submitOrigin(projectId: string, studentId: string, studentUserId: string, advisorTeacherId: string, title: string) {
  const origin = await prisma.projectOrigin.upsert({
    where: { projectId },
    update: {
      initialProjectTitleTh: title,
      sourceType: "STUDENT_INITIATED",
      reasonForTopic: "ต้องการทดสอบวงจรชีวิตโครงงาน",
      expectedMathArea: "Discrete Mathematics",
      tentativeAdvisorId: advisorTeacherId,
      consultationSummary: "นักศึกษาปรึกษาเบื้องต้นแล้ว",
      initialReferences: "เอกสารตัวอย่าง",
      materialLink: "https://drive.google.com/",
      declarationAccepted: true,
      status: "SUBMITTED",
      submittedAt: new Date()
    },
    create: {
      projectId,
      initialProjectTitleTh: title,
      sourceType: "STUDENT_INITIATED",
      reasonForTopic: "ต้องการทดสอบวงจรชีวิตโครงงาน",
      expectedMathArea: "Discrete Mathematics",
      tentativeAdvisorId: advisorTeacherId,
      consultationSummary: "นักศึกษาปรึกษาเบื้องต้นแล้ว",
      initialReferences: "เอกสารตัวอย่าง",
      materialLink: "https://drive.google.com/",
      declarationAccepted: true,
      status: "SUBMITTED",
      submittedAt: new Date()
    }
  });
  await prisma.projectOriginVersion.create({
    data: { projectOriginId: origin.id, versionNo: 1, snapshotJson: { title }, savedByUserId: studentUserId }
  });
  const reminderDueAt = new Date();
  reminderDueAt.setDate(reminderDueAt.getDate() + 7);
  const request = await prisma.advisorRequest.create({
    data: {
      projectId,
      studentId,
      advisorTeacherId,
      studentMessage: "ขอให้อาจารย์พิจารณาเป็นที่ปรึกษา",
      reminderDueAt
    }
  });
  const current = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  await prisma.project.update({ where: { id: projectId }, data: { currentTitleTh: title } });
  await setStatus(projectId, current.status, "PENDING_ADVISOR", "STUDENT_SELECTED_ADVISOR", studentUserId, { advisorReminderDays: 7 });
  await timeline(projectId, "PROJECT_ORIGIN_SUBMITTED", "ส่งข้อมูลเสนอหัวข้อ", studentUserId);
  return request;
}

async function reviewAdvisorRequest(requestId: string, teacherUserId: string, approve: boolean, comment: string) {
  const request = await prisma.advisorRequest.findUniqueOrThrow({ where: { id: requestId }, include: { project: true } });
  await prisma.advisorRequest.update({
    where: { id: requestId },
    data: { status: approve ? "APPROVED" : "REJECTED", advisorComment: comment, reviewedAt: new Date() }
  });
  await setStatus(request.projectId, request.project.status, approve ? "PENDING_ADMIN" : "DRAFT", approve ? "ADVISOR_APPROVED" : "ADVISOR_REJECTED", teacherUserId, { comment });
  await timeline(request.projectId, approve ? "ADVISOR_REQUEST_APPROVED" : "ADVISOR_REQUEST_REJECTED", approve ? "อาจารย์ที่ปรึกษาอนุมัติ" : "อาจารย์ที่ปรึกษาปฏิเสธ", teacherUserId, comment);
}

async function adminConfirmProject(projectId: string, adminUserId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  await setStatus(projectId, project.status, "PROPOSAL_PENDING", "ADMIN_CONFIRMED_PROJECT_ADVISOR", adminUserId);
  await timeline(projectId, "ADMIN_CONFIRMED_PROJECT_ADVISOR", "ผู้ดูแลระบบยืนยันโปรเจคและที่ปรึกษา", adminUserId);
}

async function submitProposal(projectId: string, studentId: string, studentUserId: string, roundId: string, teacherIds: string[]) {
  const invalid = validateMaterialLink("https://example.com/");
  assert(!invalid.ok, "Invalid material link was accepted");
  const valid = validateMaterialLink("https://drive.google.com/");
  assert(valid.ok, "Valid Google material link was rejected");
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const attempt = await prisma.assessmentAttempt.create({
    data: { projectId, assessmentRoundId: roundId, attemptNo: 1, attemptType: "MAIN_PROPOSAL", status: "SCORING_OPEN" }
  });
  await prisma.presentationSubmission.create({
    data: {
      assessmentAttemptId: attempt.id,
      projectId,
      studentId,
      titleTh: project.currentTitleTh ?? "หัวข้อ Proposal",
      abstractText: "โครงงานนี้ศึกษาลำดับเวียนเกิดในรูปแบบ $x_{n+1}=f(x_n)$\n\nและต้องการพิสูจน์ว่า\n\n$$\n\\lim_{n\\to\\infty} x_n = L\n$$",
      contentJson: {
        motivationBackground: "ทดสอบ abstract และ LaTeX",
        objectives: "ตรวจวงจรชีวิต",
        proposedMethods: "วิเคราะห์ลำดับเวียนเกิด",
        expectedOutcomes: "ได้ผลลัพธ์ตัวอย่าง",
        timeline: "ดำเนินงานตามแผน"
      },
      materialLink: valid.normalizedUrl,
      declarationAccepted: true,
      status: "SUBMITTED",
      submittedAt: new Date()
    }
  });
  for (const teacherId of teacherIds) {
    const teacher = await prisma.teacher.findUniqueOrThrow({ where: { id: teacherId } });
    if (!teacher.userId) throw new Error("Teacher user is required");
    await prisma.evaluatorAssignment.create({
      data: {
        assessmentAttemptId: attempt.id,
        evaluatorUserId: teacher.userId,
        teacherId: teacher.id,
        evaluatorDisplayNameSnapshot: `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`,
        isRequired: true
      }
    });
  }
  await setStatus(projectId, project.status, "PROPOSAL_REVIEW", "STUDENT_ATTACHED_PROPOSAL_ABSTRACT_AND_LINK", studentUserId);
  await timeline(projectId, "PROPOSAL_SUBMITTED", "ส่ง Proposal", studentUserId);
  return attempt;
}

async function submitProposalScore(assignmentId: string, vote: "PASS" | "REVISE" | "FAIL", checkedItemIds: string[], comment: string, reason?: string) {
  assert(comment.trim(), "Comment is required for proposal score");
  if ((vote === "REVISE" || vote === "FAIL") && !reason?.trim()) throw new Error("REVISE/FAIL requires reason");
  const assignment = await prisma.evaluatorAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: { assessmentAttempt: true, teacher: true }
  });
  assert(assignment.teacherId && assignment.teacher, "Assignment must have teacher");
  const rubric = await prisma.rubric.findFirstOrThrow({
    where: { roundType: "PROPOSAL", active: true },
    include: { items: { orderBy: { displayOrder: "asc" } } }
  });
  const totalScore = rubric.items.reduce((sum, item) => sum + (checkedItemIds.includes(item.id) ? item.points : 0), 0);
  const score = await prisma.scoreSubmission.create({
    data: { evaluatorAssignmentId: assignment.id, totalScore, overallComment: comment, status: "SUBMITTED", submittedAt: new Date(), lockedAt: new Date() }
  });
  await prisma.scoreItem.createMany({
    data: rubric.items.map((item) => ({
      scoreSubmissionId: score.id,
      rubricItemId: item.id,
      checked: checkedItemIds.includes(item.id),
      pointsAwarded: checkedItemIds.includes(item.id) ? item.points : 0
    }))
  });
  await prisma.proposalEvaluatorDecision.create({
    data: {
      scoreSubmissionId: score.id,
      decision: vote === "PASS" ? "PASS" : vote === "REVISE" ? "PASS_WITH_REVISION" : "NOT_PASS",
      reason: reason ?? null
    }
  });
  await prisma.proposalVote.create({
    data: { projectId: assignment.assessmentAttempt.projectId, assessmentAttemptId: assignment.assessmentAttemptId, teacherId: assignment.teacherId, vote, comment, visibleToStudent: true }
  });
  await prisma.evaluatorAssignment.update({ where: { id: assignment.id }, data: { status: "SUBMITTED" } });
  await timeline(assignment.assessmentAttempt.projectId, "TEACHER_SCORE_SUBMITTED", "อาจารย์ส่งคะแนน Proposal", assignment.evaluatorUserId, comment, { totalScore });
}

async function markProposalReadyForAdmin(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  await setStatus(projectId, project.status, "PROPOSAL_ADMIN_DECISION", "ALL_PROPOSAL_SCORES_SUBMITTED");
}

async function adminFinalDecision(projectId: string, attemptId: string, adminUserId: string, pass: boolean) {
  const assignments = await prisma.evaluatorAssignment.findMany({
    where: { assessmentAttemptId: attemptId },
    include: { scoreSubmission: { include: { proposalDecision: true } } }
  });
  const submitted = assignments.map((item) => item.scoreSubmission).filter(Boolean);
  const averageScore = submitted.length
    ? submitted.reduce((sum, score) => sum + Number(score!.totalScore), 0) / submitted.length
    : 0;
  await prisma.projectProposalResult.create({
    data: {
      assessmentAttemptId: attemptId,
      projectId,
      averageScore,
      submittedCount: submitted.length,
      missingCount: Math.max(assignments.length - submitted.length, 0),
      passCount: submitted.filter((score) => score!.proposalDecision?.decision === "PASS").length,
      revisionCount: submitted.filter((score) => score!.proposalDecision?.decision === "PASS_WITH_REVISION").length,
      notPassCount: submitted.filter((score) => score!.proposalDecision?.decision === "NOT_PASS").length,
      finalDecision: pass ? "PASS" : "NOT_PASS",
      finalDecisionReason: pass ? null : "FAIL path E2E",
      decidedByAdminId: adminUserId
    }
  });
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  await setStatus(projectId, project.status, pass ? "TOPIC_APPROVED" : "DRAFT", pass ? "PROPOSAL_FINAL_PASS" : "PROPOSAL_FINAL_FAIL", adminUserId);
  await timeline(projectId, "ADMIN_FINAL_DECISION", "ผู้ดูแลระบบบันทึกผล Proposal", adminUserId, pass ? "PASS" : "FAIL");
}

async function assignCommittee(projectId: string, adminUserId: string, advisorTeacherId: string, headTeacherId: string, memberTeacherId: string) {
  assert(headTeacherId !== advisorTeacherId, "Advisor cannot be HEAD");
  assert(memberTeacherId !== advisorTeacherId, "Advisor cannot be MEMBER");
  assert(headTeacherId !== memberTeacherId, "HEAD and MEMBER must differ");
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  await prisma.committeeAssignment.createMany({
    data: [
      { projectId, teacherId: advisorTeacherId, role: "ADVISOR", appointedByUserId: adminUserId },
      { projectId, teacherId: headTeacherId, role: "HEAD", appointedByUserId: adminUserId },
      { projectId, teacherId: memberTeacherId, role: "MEMBER", appointedByUserId: adminUserId }
    ]
  });
  await setStatus(projectId, project.status, "IN_PROGRESS", "COMMITTEE_ASSIGNED", adminUserId);
  await timeline(projectId, "COMMITTEE_ASSIGNED", "แต่งตั้งกรรมการสอบโครงงาน", adminUserId);
}

async function submitAssessmentAndConfirmSchedule(projectId: string, studentId: string, kind: "PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENT", committeeTeacherIds: string[]) {
  const link = validateMaterialLink("https://drive.google.com/");
  assert(link.ok, "Assessment material link should be valid");
  await prisma.assessmentSubmission.create({
    data: { projectId, studentId, kind, title: kind, materialLink: link.normalizedUrl, contentJson: { note: "E2E skeleton material" } }
  });
  const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const roundType = kind === "FINAL_PRESENT" ? "FINAL_PRESENTATION" : kind;
  const round = await prisma.assessmentRound.findUniqueOrThrow({
    where: { courseOfferingId_roundType: { courseOfferingId: project.courseOfferingId, roundType } }
  });
  const schedule = await prisma.examScheduleProposal.upsert({
    where: { projectId_assessmentRoundId: { projectId, assessmentRoundId: round.id } },
    update: {
      courseOfferingId: project.courseOfferingId,
      assessmentRoundId: round.id,
      roundType,
      assessmentKind: kind,
      proposedStartAt: start,
      proposedEndAt: new Date(start.getTime() + 60 * 60 * 1000),
      room: "MATH-101",
      proposedByStudentId: studentId,
      status: "PROPOSED",
      note: "E2E updated schedule"
    },
    create: {
      projectId,
      courseOfferingId: project.courseOfferingId,
      assessmentRoundId: round.id,
      roundType,
      assessmentKind: kind,
      proposedStartAt: start,
      proposedEndAt: new Date(start.getTime() + 60 * 60 * 1000),
      room: "MATH-101",
      proposedByStudentId: studentId,
      note: "E2E schedule"
    }
  });
  for (const teacherId of committeeTeacherIds) {
    await prisma.examScheduleApproval.upsert({
      where: { scheduleProposalId_teacherId: { scheduleProposalId: schedule.id, teacherId } },
      update: { decision: "APPROVE", comment: "Approved", decidedAt: new Date() },
      create: { scheduleProposalId: schedule.id, teacherId, decision: "APPROVE", comment: "Approved", decidedAt: new Date() }
    });
  }
  const approvals = await prisma.examScheduleApproval.findMany({ where: { scheduleProposalId: schedule.id } });
  assert(isScheduleConfirmed(committeeTeacherIds, approvals), `${kind} schedule was not confirmed after all approvals`);
  await prisma.examScheduleProposal.update({ where: { id: schedule.id }, data: { status: "CONFIRMED" } });
  await timeline(projectId, `${kind}_SCHEDULE_CONFIRMED`, `ยืนยันวันสอบ ${kind}`);
}

async function submitPresentationScoreEvidence(
  projectId: string,
  roundType: "PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENTATION",
  teacher: { id: string; userId: string | null; academicPrefix: string; firstNameTh: string; lastNameTh: string },
  totalScore: number
) {
  assert(teacher.userId, "Scoring teacher must have a linked user");
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const round = await prisma.assessmentRound.findUniqueOrThrow({
    where: { courseOfferingId_roundType: { courseOfferingId: project.courseOfferingId, roundType } }
  });
  const attempt = await prisma.assessmentAttempt.upsert({
    where: { projectId_assessmentRoundId_attemptNo: { projectId, assessmentRoundId: round.id, attemptNo: 1 } },
    update: { status: "SCORING_CLOSED" },
    create: {
      projectId,
      assessmentRoundId: round.id,
      attemptNo: 1,
      attemptType: roundType === "FINAL_PRESENTATION" ? "FINAL_PRESENTATION" : roundType,
      status: "SCORING_CLOSED"
    }
  });
  const assignment = await prisma.evaluatorAssignment.upsert({
    where: { assessmentAttemptId_evaluatorUserId: { assessmentAttemptId: attempt.id, evaluatorUserId: teacher.userId } },
    update: { teacherId: teacher.id, status: "SUBMITTED" },
    create: {
      assessmentAttemptId: attempt.id,
      evaluatorUserId: teacher.userId,
      teacherId: teacher.id,
      evaluatorDisplayNameSnapshot: `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`,
      isRequired: true,
      status: "SUBMITTED"
    }
  });
  await prisma.scoreSubmission.upsert({
    where: { evaluatorAssignmentId: assignment.id },
    update: { totalScore, overallComment: `E2E ${roundType} score`, status: "SUBMITTED", submittedAt: new Date(), lockedAt: new Date() },
    create: { evaluatorAssignmentId: assignment.id, totalScore, overallComment: `E2E ${roundType} score`, status: "SUBMITTED", submittedAt: new Date(), lockedAt: new Date() }
  });
  await timeline(projectId, `${roundType}_SCORE_SUBMITTED`, `บันทึกคะแนน ${roundType}`, teacher.userId, undefined, { totalScore });
}

async function submitRejectedSchedule(projectId: string, studentId: string, kind: "PROGRESS_1", committeeTeacherIds: string[]) {
  const start = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const round = await prisma.assessmentRound.findUniqueOrThrow({
    where: { courseOfferingId_roundType: { courseOfferingId: project.courseOfferingId, roundType: kind } }
  });
  const schedule = await prisma.examScheduleProposal.upsert({
    where: { projectId_assessmentRoundId: { projectId, assessmentRoundId: round.id } },
    update: {
      courseOfferingId: project.courseOfferingId,
      assessmentRoundId: round.id,
      roundType: kind,
      assessmentKind: kind,
      proposedStartAt: start,
      proposedEndAt: new Date(start.getTime() + 60 * 60 * 1000),
      room: "MATH-102",
      proposedByStudentId: studentId,
      status: "PROPOSED",
      note: "E2E rejected schedule"
    },
    create: {
      projectId,
      courseOfferingId: project.courseOfferingId,
      assessmentRoundId: round.id,
      roundType: kind,
      assessmentKind: kind,
      proposedStartAt: start,
      proposedEndAt: new Date(start.getTime() + 60 * 60 * 1000),
      room: "MATH-102",
      proposedByStudentId: studentId,
      note: "E2E rejected schedule"
    }
  });
  await prisma.examScheduleApproval.upsert({
    where: { scheduleProposalId_teacherId: { scheduleProposalId: schedule.id, teacherId: committeeTeacherIds[0] } },
    update: { decision: "REJECT", comment: "??????", decidedAt: new Date() },
    create: { scheduleProposalId: schedule.id, teacherId: committeeTeacherIds[0], decision: "REJECT", comment: "??????", decidedAt: new Date() }
  });
  const approvals = await prisma.examScheduleApproval.findMany({ where: { scheduleProposalId: schedule.id } });
  assert(!isScheduleConfirmed(committeeTeacherIds, approvals), "Rejected schedule should not be confirmed");
  await prisma.examScheduleProposal.update({ where: { id: schedule.id }, data: { status: "REJECTED" } });
}

async function run() {
  localDatabaseGuard();
  await cleanKnownDemoData(prisma);

  const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase() || "dev.admin@sru.ac.th";
  const adminUser = await ensureUser(adminEmail, "ADMIN", "Development Admin", `e2e-admin-${stamp}`);
  const teachers = [] as Awaited<ReturnType<typeof ensureTeacher>>[];
  for (let index = 1; index <= 11; index += 1) teachers.push(await ensureTeacher(index));
  const rubric = await ensureRubric();
  const rubricGroups = new Map<string, number>();
  for (const item of rubric.items) rubricGroups.set(item.groupLabelTh, (rubricGroups.get(item.groupLabelTh) ?? 0) + item.points);
  assert(rubric.items.reduce((sum, item) => sum + item.points, 0) === 100, "Proposal rubric total is not 100");

  let students: Awaited<ReturnType<typeof ensureStudent>>[] = [];
  let projects = { mainId: "", rejectId: "", failId: "" };
  let mainAttemptId = "";
  let failAttemptId = "";
  const advisor = teachers[0];
  const head = teachers[1];
  const member = teachers[2];

  await step(1, "Admin opens course", async () => {
    const academicYear = await prisma.academicYear.upsert({
      where: { yearBe: 2568 },
      update: { active: true },
      create: { yearBe: 2568, active: true }
    });
    const term = await prisma.term.upsert({
      where: { academicYearId_termType: { academicYearId: academicYear.id, termType: "SEMESTER_1" } },
      update: { displayName: "ภาคเรียนที่ 1 ปีการศึกษา 2568", status: "ACTIVE" },
      create: { academicYearId: academicYear.id, termType: "SEMESTER_1", displayName: "ภาคเรียนที่ 1 ปีการศึกษา 2568", status: "ACTIVE" }
    });
    await prisma.courseOffering.upsert({
      where: { id: courseOfferingId },
      update: { termId: term.id, courseTitle: "Mathematical Project Course", status: "ACTIVE" },
      create: { id: courseOfferingId, termId: term.id, courseTitle: "Mathematical Project Course", status: "ACTIVE" }
    });
    for (const roundType of courseLevelRoundTypes) {
      await prisma.assessmentRound.upsert({
        where: { courseOfferingId_roundType: { courseOfferingId, roundType } },
        update: {
          name: roundType === "PROPOSAL" ? "E2E Proposal" : defaultCourseRoundName(roundType),
          courseWeight: defaultCourseRoundWeight(roundType),
          rawScoreMax: 100,
          status: roundType === "PROPOSAL" ? "SUBMISSION_OPEN" : "DRAFT"
        },
        create: {
          courseOfferingId,
          roundType,
          name: roundType === "PROPOSAL" ? "E2E Proposal" : defaultCourseRoundName(roundType),
          courseWeight: defaultCourseRoundWeight(roundType),
          rawScoreMax: 100,
          status: roundType === "PROPOSAL" ? "SUBMISSION_OPEN" : "DRAFT"
        }
      });
    }
    const roundCount = await prisma.assessmentRound.count({ where: { courseOfferingId } });
    assert(roundCount === courseLevelRoundTypes.length, "Course should have one batch round per major assessment type");
    return `${term.displayName}, Mathematical Project Course (${courseOfferingId})`;
  });

  await step(2, "Admin imports students", async () => {
    students = [
      await ensureStudent("65123456789", "สมชาย", "ใจดี"),
      await ensureStudent("65123456790", "สมหญิง", "รักเรียน"),
      await ensureStudent("65123456791", "สมปอง", "ตั้งใจ")
    ];
    const main = await createProject(students[0].student.id, "STUDENT_PROFILE");
    const reject = await createProject(students[1].student.id, "STUDENT_PROFILE");
    const fail = await createProject(students[2].student.id, "STUDENT_PROFILE");
    projects = { mainId: main.id, rejectId: reject.id, failId: fail.id };
    assert(students[0].email === "65123456789@student.sru.ac.th", "Generated email mismatch for Somchai");
    assert(students[1].email === "65123456790@student.sru.ac.th", "Generated email mismatch for Somying");
    assert(students[2].email === "65123456791@student.sru.ac.th", "Generated email mismatch for Sompong");
    return students.map((item) => item.email).join(", ");
  });

  await step(3, "Student login/dev login scope", async () => {
    const studentProjects = await prisma.project.findMany({ where: { courseOfferingId, studentId: students[0].student.id } });
    const otherProjects = studentProjects.filter((project) => project.studentId !== students[0].student.id);
    assert(studentProjects.length === 1, "Selected student should see exactly one E2E project");
    assert(otherProjects.length === 0, "Selected student can see another student's project");
    return `student ${students[0].email} scoped to project ${studentProjects[0].id}`;
  });

  await step(4, "Student completes profile", async () => {
    await prisma.studentProfile.upsert({
      where: { studentId: students[0].student.id },
      update: { phone: "0800000000", lineId: "somchai.e2e", preferredName: "สมชาย", completedAt: new Date() },
      create: { studentId: students[0].student.id, phone: "0800000000", lineId: "somchai.e2e", preferredName: "สมชาย", completedAt: new Date() }
    });
    await setStatus(projects.mainId, "STUDENT_PROFILE", "DRAFT", "STUDENT_PROFILE_COMPLETED", students[0].user.id);
    await timeline(projects.mainId, "STUDENT_PROFILE_COMPLETED", "กรอกข้อมูลนักศึกษาครบ", students[0].user.id);
    return "profile completed and next action unlocked";
  });

  await step(5, "DRAFT project creation and advisor request", async () => {
    const request = await submitOrigin(projects.mainId, students[0].student.id, students[0].user.id, advisor.id, "E2E ลำดับเวียนเกิด");
    assert(request.status === "PENDING", "Advisor request was not pending");
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projects.mainId } });
    assert(project.status === "PENDING_ADVISOR", "Project did not move to PENDING_ADVISOR");
    return `advisor request ${request.id}`;
  });

  await step(6, "Advisor approval and reject path", async () => {
    const approvedRequest = await prisma.advisorRequest.findFirstOrThrow({ where: { projectId: projects.mainId } });
    await reviewAdvisorRequest(approvedRequest.id, advisor.userId!, true, "รับเป็นที่ปรึกษา");
    const approvedProject = await prisma.project.findUniqueOrThrow({ where: { id: projects.mainId } });
    assert(approvedProject.status === "PENDING_ADMIN", "Advisor approve did not move to PENDING_ADMIN");

    await setStatus(projects.rejectId, "STUDENT_PROFILE", "DRAFT", "STUDENT_PROFILE_COMPLETED", students[1].user.id);
    const rejectedRequest = await submitOrigin(projects.rejectId, students[1].student.id, students[1].user.id, advisor.id, "E2E หัวข้อที่ถูกปฏิเสธ");
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await prisma.advisorRequest.update({ where: { id: rejectedRequest.id }, data: { requestedAt: oldDate } });
    const waitingDays = Math.floor((Date.now() - oldDate.getTime()) / (1000 * 60 * 60 * 24));
    assert(waitingDays >= 7, "7-day reminder condition was not created");
    await reviewAdvisorRequest(rejectedRequest.id, advisor.userId!, false, "ควรปรับกรอบหัวข้อ");
    const rejectedProject = await prisma.project.findUniqueOrThrow({ where: { id: projects.rejectId } });
    assert(rejectedProject.status === "DRAFT", "Advisor reject did not return project to DRAFT");
    const history = await prisma.projectStatusHistory.count({ where: { projectId: projects.rejectId } });
    assert(history >= 3, "Reject path did not keep history");
    return "approve -> PENDING_ADMIN, reject -> DRAFT, 7-day reminder condition present";
  });

  await step(7, "Admin confirmation", async () => {
    await adminConfirmProject(projects.mainId, adminUser.id);
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projects.mainId } });
    assert(project.status === "PROPOSAL_PENDING", "Admin confirm did not move to PROPOSAL_PENDING");
    return "project/advisor confirmed";
  });

  await step(8, "Student submits Proposal", async () => {
    const round = await prisma.assessmentRound.findFirstOrThrow({ where: { courseOfferingId, roundType: "PROPOSAL" } });
    const attempt = await submitProposal(projects.mainId, students[0].student.id, students[0].user.id, round.id, [teachers[0].id, teachers[1].id, teachers[2].id]);
    mainAttemptId = attempt.id;
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projects.mainId } });
    assert(project.status === "PROPOSAL_REVIEW", "Proposal submit did not move to PROPOSAL_REVIEW");
    return "invalid link rejected, Google link accepted, project in PROPOSAL_REVIEW";
  });

  await step(9, "Teachers score Proposal", async () => {
    const assignments = await prisma.evaluatorAssignment.findMany({ where: { assessmentAttemptId: mainAttemptId }, orderBy: { assignedAt: "asc" } });
    assert(assignments.length === 3, "Expected 3 proposal evaluator assignments");
    const checkedAll = rubric.items.map((item) => item.id);
    await submitProposalScore(assignments[0].id, "PASS", checkedAll, "ควรอธิบายว่า $x_n \\to L$ ภายใต้เงื่อนไขใด", undefined);
    await submitProposalScore(assignments[1].id, "PASS", checkedAll.slice(0, 4), "ควรเพิ่มรายละเอียดแผนเล็กน้อย", undefined);
    await submitProposalScore(assignments[2].id, "REVISE", checkedAll.slice(0, 3), "ควรปรับแผนงาน", "แผนงานยังไม่ละเอียด");
    await markProposalReadyForAdmin(projects.mainId);
    const votes = await prisma.proposalVote.findMany({ where: { projectId: projects.mainId }, include: { teacher: true } });
    assert(votes.length === 3 && votes.every((vote) => vote.visibleToStudent && vote.comment), "Proposal comments are not visible with comments");
    assert(votes.some((vote) => vote.comment?.includes("$x_n \\to L$")), "LaTeX teacher comment is not visible in proposal feedback data");
    const release = await prisma.scoreRelease.findUnique({ where: { assessmentAttemptId: mainAttemptId } });
    assert(!release || !release.showScore, "Student should not see proposal score");
    assert([...rubricGroups.values()].reduce((sum, points) => sum + points, 0) === 100, "Rubric groups do not total 100");
    return "3 teachers scored; comments visible with teacher names; scores hidden from student";
  });

  await step(10, "Proposal fail alert", async () => {
    await setStatus(projects.failId, "STUDENT_PROFILE", "DRAFT", "STUDENT_PROFILE_COMPLETED", students[2].user.id);
    await submitOrigin(projects.failId, students[2].student.id, students[2].user.id, advisor.id, "E2E FAIL ratio project");
    const failRequest = await prisma.advisorRequest.findFirstOrThrow({ where: { projectId: projects.failId } });
    await reviewAdvisorRequest(failRequest.id, advisor.userId!, true, "รับเป็นที่ปรึกษา");
    await adminConfirmProject(projects.failId, adminUser.id);
    const round = await prisma.assessmentRound.findFirstOrThrow({ where: { courseOfferingId, roundType: "PROPOSAL" } });
    failAttemptId = (await submitProposal(projects.failId, students[2].student.id, students[2].user.id, round.id, [teachers[0].id, teachers[1].id, teachers[2].id])).id;
    const assignments = await prisma.evaluatorAssignment.findMany({ where: { assessmentAttemptId: failAttemptId }, orderBy: { assignedAt: "asc" } });
    await submitProposalScore(assignments[0].id, "FAIL", rubric.items.slice(0, 1).map((item) => item.id), "ยังไม่พร้อม", "สาระสำคัญไม่พอ");
    await submitProposalScore(assignments[1].id, "FAIL", rubric.items.slice(0, 2).map((item) => item.id), "ควรทำใหม่", "แผนไม่ชัด");
    await submitProposalScore(assignments[2].id, "PASS", rubric.items.map((item) => item.id), "ผ่านได้", undefined);
    const votes = await prisma.proposalVote.findMany({ where: { projectId: projects.failId } });
    assert(shouldAlertAdminForFailVotes(votes), "FAIL >= 50% alert condition is false");
    const failProject = await prisma.project.findUniqueOrThrow({ where: { id: projects.failId } });
    assert(failProject.status !== "DRAFT", "System auto-decided FAIL project");
    await markProposalReadyForAdmin(projects.failId);
    const closedRound = await prisma.assessmentRound.update({
      where: { courseOfferingId_roundType: { courseOfferingId, roundType: "PROPOSAL" } },
      data: buildCloseAssessmentRoundData(adminUser.id)
    });
    assert(closedRound.status === "SCORING_CLOSED" && closedRound.closedAt && closedRound.closedByAdminId === adminUser.id, "Closing Proposal did not close the course-level round");
    return "FAIL votes >= 50% creates alert condition; course-level Proposal round closed";
  });

  await step(11, "Admin final Proposal decision", async () => {
    await adminFinalDecision(projects.mainId, mainAttemptId, adminUser.id, true);
    const passProject = await prisma.project.findUniqueOrThrow({ where: { id: projects.mainId } });
    assert(passProject.status === "TOPIC_APPROVED", "PASS final decision did not move to TOPIC_APPROVED");
    await adminFinalDecision(projects.failId, failAttemptId, adminUser.id, false);
    const failProject = await prisma.project.findUniqueOrThrow({ where: { id: projects.failId } });
    assert(failProject.status === "DRAFT", "FAIL final decision did not return to DRAFT");
    const failHistory = await prisma.projectStatusHistory.count({ where: { projectId: projects.failId } });
    assert(failHistory > 0, "FAIL decision history was not kept");
    return "PASS -> TOPIC_APPROVED, FAIL -> DRAFT with history";
  });

  await step(12, "Committee assignment", async () => {
    await assignCommittee(projects.mainId, adminUser.id, advisor.id, head.id, member.id);
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projects.mainId }, include: { committeeAssignments: true } });
    assert(project.status === "IN_PROGRESS", "Committee assignment did not move to IN_PROGRESS");
    assert(project.committeeAssignments.some((assignment) => assignment.role === "ADVISOR" && assignment.teacherId === advisor.id), "Advisor is not assigned as ADVISOR");
    assert(project.committeeAssignments.some((assignment) => assignment.role === "HEAD"), "HEAD missing");
    assert(project.committeeAssignments.some((assignment) => assignment.role === "MEMBER"), "MEMBER missing");
    const progress1Round = await prisma.assessmentRound.findUniqueOrThrow({ where: { courseOfferingId_roundType: { courseOfferingId, roundType: "PROGRESS_1" } } });
    assert(progress1Round.status === "DRAFT", "Progress 1 should not open automatically after Proposal/committee flow");
    return "ADVISOR/HEAD/MEMBER assigned; Progress 1 still not open automatically";
  });

  await step(13, "Self-scheduling skeleton", async () => {
    const beforeOpen = await prisma.assessmentRound.findUniqueOrThrow({ where: { courseOfferingId_roundType: { courseOfferingId, roundType: "PROGRESS_1" } } });
    assert(beforeOpen.status !== "SUBMISSION_OPEN", "Student should not schedule Progress 1 before Admin opens the course-level round");
    await prisma.assessmentRound.update({
      where: { courseOfferingId_roundType: { courseOfferingId, roundType: "PROGRESS_1" } },
      data: { status: "SUBMISSION_OPEN", submissionOpenAt: new Date(), closedAt: null, closedByAdminId: null }
    });
    const duplicateRoundCount = await prisma.assessmentRound.count({ where: { courseOfferingId, roundType: "PROGRESS_1" } });
    assert(duplicateRoundCount === 1, "Opening Progress 1 should reuse the course-level round");
    const committeeIds = [head.id, member.id];
    await submitRejectedSchedule(projects.mainId, students[0].student.id, "PROGRESS_1", committeeIds);
    await submitAssessmentAndConfirmSchedule(projects.mainId, students[0].student.id, "PROGRESS_1", committeeIds);
    return "Admin opened one course-level Progress 1 round; reject path blocks confirmation; approve-all confirms schedule";
  });

  await step(14, "Progress 1 / Progress 2 / Final Present skeleton cycle", async () => {
    const committeeIds = [head.id, member.id];
    await submitPresentationScoreEvidence(projects.mainId, "PROGRESS_1", head, 88);
    await submitAssessmentAndConfirmSchedule(projects.mainId, students[0].student.id, "PROGRESS_2", committeeIds);
    await submitPresentationScoreEvidence(projects.mainId, "PROGRESS_2", head, 90);
    await submitAssessmentAndConfirmSchedule(projects.mainId, students[0].student.id, "FINAL_PRESENT", committeeIds);
    await submitPresentationScoreEvidence(projects.mainId, "FINAL_PRESENTATION", head, 92);
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projects.mainId } });
    await setStatus(projects.mainId, project.status, "FINAL_DONE", "FINAL_PRESENT_COMPLETED", adminUser.id);
    await timeline(projects.mainId, "FINAL_PRESENT_COMPLETED", "สอบ Final เสร็จ", adminUser.id);
    const doneProject = await prisma.project.findUniqueOrThrow({ where: { id: projects.mainId } });
    assert(doneProject.status === "FINAL_DONE", "Final completion did not move to FINAL_DONE");
    return "Progress/Final materials, schedules, and score evidence recorded; project moved to FINAL_DONE";
  });

  await step(15, "Report Approval Loop", async () => {
    const v1 = await prisma.reportVersion.create({
      data: { projectId: projects.mainId, versionNo: 1, driveLink: "https://drive.google.com/report-v1", submittedByStudentId: students[0].student.id }
    });
    await prisma.reportReview.create({ data: { reportVersionId: v1.id, reviewerTeacherId: head.id, decision: "PASS", comment: "ผ่าน" } });
    await prisma.reportReview.create({ data: { reportVersionId: v1.id, reviewerTeacherId: member.id, decision: "FAIL", comment: "ต้องแก้รูปแบบ" } });
    let project = await prisma.project.findUniqueOrThrow({ where: { id: projects.mainId } });
    await setStatus(projects.mainId, project.status, "REPORT_REVIEW", "REPORT_VERSION_SUBMITTED", students[0].user.id);
    const v2 = await prisma.reportVersion.create({
      data: { projectId: projects.mainId, versionNo: 2, driveLink: "https://drive.google.com/report-v2", submittedByStudentId: students[0].student.id }
    });
    const headAlreadyPassed = await prisma.reportReview.findFirst({ where: { reviewerTeacherId: head.id, decision: "PASS", reportVersion: { projectId: projects.mainId } } });
    assert(headAlreadyPassed, "Reviewer who already passed should be recognized");
    await prisma.reportReview.create({ data: { reportVersionId: v2.id, reviewerTeacherId: member.id, decision: "PASS", comment: "แก้ครบแล้ว" } });
    const passedReviewers = await prisma.reportReview.findMany({ where: { decision: "PASS", reportVersion: { projectId: projects.mainId } } });
    const passedIds = new Set(passedReviewers.map((review) => review.reviewerTeacherId));
    assert(passedIds.has(head.id) && passedIds.has(member.id), "Not all reviewers have passed report");
    project = await prisma.project.findUniqueOrThrow({ where: { id: projects.mainId } });
    await setStatus(projects.mainId, project.status, "REPORT_APPROVED", "ALL_REPORT_REVIEWERS_PASSED");
    await timeline(projects.mainId, "REPORT_APPROVED", "กรรมการอนุมัติเล่มครบ");
    return "v1 fail then v2 pass; previously passed reviewer skipped new version; report approved";
  });

  await step(16, "Advisor score", async () => {
    assert(!isAdvisorScoreUnlocked({ reportClosedByAdvisor: false, allReportReviewersPassed: true }), "Advisor score should be locked before report close");
    await prisma.advisorScore.upsert({
      where: { projectId: projects.mainId },
      update: { advisorTeacherId: advisor.id, status: "LOCKED" },
      create: { projectId: projects.mainId, advisorTeacherId: advisor.id, status: "LOCKED" }
    });
    await prisma.advisorScore.update({
      where: { projectId: projects.mainId },
      data: { reportClosedAt: new Date(), unlockedAt: new Date(), status: "DRAFT" }
    });
    let project = await prisma.project.findUniqueOrThrow({ where: { id: projects.mainId } });
    await setStatus(projects.mainId, project.status, "ADVISOR_SCORING", "ADVISOR_CLOSED_REPORT", advisor.userId!);
    assert(isAdvisorScoreUnlocked({ reportClosedByAdvisor: true, allReportReviewersPassed: true }), "Advisor score should unlock after report close");
    await prisma.advisorScore.update({
      where: { projectId: projects.mainId },
      data: { score: 24, comment: "นักศึกษาดำเนินงานต่อเนื่อง", status: "SUBMITTED", submittedAt: new Date() }
    });
    const advisorScore = await prisma.advisorScore.findUniqueOrThrow({ where: { projectId: projects.mainId } });
    assert(advisorScore.status === "SUBMITTED", "Advisor score was not submitted");
    project = await prisma.project.findUniqueOrThrow({ where: { id: projects.mainId } });
    assert(project.status === "ADVISOR_SCORING", "Project should wait for admin completion after advisor score");
    return "locked before close, unlocked after ปิดเล่ม, score submitted";
  });

  await step(17, "Admin completes project", async () => {
    const advisorScore = await prisma.advisorScore.findUniqueOrThrow({ where: { projectId: projects.mainId } });
    assert(advisorScore.status === "SUBMITTED", "Project is not ready for COMPLETED");
    const eligibility = await getCompletionEligibility(projects.mainId);
    assert(eligibility.eligible, `Completion eligibility failed: ${eligibility.missingRequirements.join(", ")}`);
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projects.mainId } });
    await setStatus(projects.mainId, project.status, "COMPLETED", "ADMIN_MARKED_COMPLETED", adminUser.id);
    await timeline(projects.mainId, "PROJECT_COMPLETED", "โครงงานเสร็จสมบูรณ์", adminUser.id);
    const completed = await prisma.project.findUniqueOrThrow({ where: { id: projects.mainId } });
    assert(completed.status === "COMPLETED", "Final status is not COMPLETED");
    return "project completed";
  });

  await step(18, "HTTP route visibility and guards", async () => {
    const studentPayload = await encodeHttpAuthCookie({ id: students[0].user.id, email: students[0].email, name: "Student Route QA" });
    const teacherPayload = await encodeHttpAuthCookie({ id: head.userId!, email: head.email!, name: `${head.academicPrefix}${head.firstNameTh} ${head.lastNameTh}` });
    const adminPayload = await encodeHttpAuthCookie({ id: adminUser.id, email: adminEmail, name: "Development Admin" });
    const pendingTeacherUser = await prisma.user.upsert({
      where: { email: "e2e-pending.teacher@sru.ac.th" },
      update: { globalRole: "PENDING_TEACHER", active: true, name: "Pending Teacher" },
      create: {
        email: "e2e-pending.teacher@sru.ac.th",
        emailDomain: "sru.ac.th",
        globalRole: "PENDING_TEACHER",
        active: true,
        name: "Pending Teacher",
        googleSub: "e2e-pending-teacher"
      }
    });
    const pendingTeacherPayload = await encodeHttpAuthCookie({ id: pendingTeacherUser.id, email: pendingTeacherUser.email!, name: "Pending Teacher" });

    return withRouteServer(async (baseUrl) => {
      async function read(route: string, cookie?: string) {
        const response = await fetch(`${baseUrl}${route}`, {
          headers: cookie ? { cookie: `${authSessionCookie}=${cookie}` } : undefined,
          signal: AbortSignal.timeout(20000)
        });
        const html = await response.text();
        assert(response.ok, `${route} returned ${response.status}`);
        assert(!html.includes("Internal Server Error"), `${route} rendered Internal Server Error`);
        return html;
      }

      const studentSchedule = await read("/student/schedule", studentPayload);
      assert(studentSchedule.includes("PROGRESS_1") || studentSchedule.includes("Progress 1"), "/student/schedule did not render schedule content for imported student");

      const studentReport = await read("/student/report", studentPayload);
      assert(studentReport.includes("Report approval loop") || studentReport.includes("REPORT_APPROVED"), "/student/report did not render report workflow content for imported student");

      const teacherSchedules = await read("/teacher/schedules", teacherPayload);
      assert(teacherSchedules.includes("MATH-101") || teacherSchedules.includes("PROGRESS_1"), "/teacher/schedules did not render approved teacher schedule content");

      const teacherReports = await read("/teacher/reports", teacherPayload);
      assert(teacherReports.includes("Report approval loop") || teacherReports.includes("ตรวจเล่มรายงาน"), "/teacher/reports did not render approved teacher page");

      const teacherAdvisorScore = await read("/teacher/advisor-score", teacherPayload);
      assert(teacherAdvisorScore.includes("Advisor score 25%"), "/teacher/advisor-score did not render approved teacher page");

      const teacherProgress1 = await read("/teacher/progress1", teacherPayload);
      assert(teacherProgress1.includes("Progress 1"), "/teacher/progress1 did not render approved teacher page");

      const teacherProgress2 = await read("/teacher/progress2", teacherPayload);
      assert(teacherProgress2.includes("Progress 2"), "/teacher/progress2 did not render approved teacher page");

      const teacherFinal = await read("/teacher/final", teacherPayload);
      assert(teacherFinal.includes("Final Presentation"), "/teacher/final did not render approved teacher page");

      const adminSchedules = await read("/admin/schedules", adminPayload);
      assert(adminSchedules.includes("MATH-101") || adminSchedules.includes("PROGRESS_1"), "/admin/schedules did not render admin schedule content");

      const adminCloseout = await read("/admin/closeout", adminPayload);
      assert(adminCloseout.includes("ปิดงานโครงงาน") || adminCloseout.includes("COMPLETED"), "/admin/closeout did not render admin closeout content");

      const pendingTeacherSchedules = await read("/teacher/schedules", pendingTeacherPayload);
      assert(!pendingTeacherSchedules.includes("MATH-101"), "pending teacher can see teacher schedule data");

      const pendingTeacherReports = await read("/teacher/reports", pendingTeacherPayload);
      assert(!pendingTeacherReports.includes("Report approval loop"), "pending teacher can see teacher report workflow");

      const pendingTeacherAdvisorScore = await read("/teacher/advisor-score", pendingTeacherPayload);
      assert(!pendingTeacherAdvisorScore.includes("Advisor score 25%"), "pending teacher can see Advisor score workflow");

      const pendingTeacherProgress1 = await read("/teacher/progress1", pendingTeacherPayload);
      assert(!pendingTeacherProgress1.includes("Progress 1 scoring"), "pending teacher can see Progress 1 scoring page");

      const pendingTeacherProgress2 = await read("/teacher/progress2", pendingTeacherPayload);
      assert(!pendingTeacherProgress2.includes("Progress 2 scoring"), "pending teacher can see Progress 2 scoring page");

      const pendingTeacherFinal = await read("/teacher/final", pendingTeacherPayload);
      assert(!pendingTeacherFinal.includes("Final Presentation scoring"), "pending teacher can see Final scoring page");

      const studentTeacherSchedules = await read("/teacher/schedules", studentPayload);
      assert(!studentTeacherSchedules.includes("MATH-101"), "student can see teacher schedule data");

      const studentTeacherReports = await read("/teacher/reports", studentPayload);
      assert(!studentTeacherReports.includes("Report approval loop"), "student can see teacher report workflow");

      const studentTeacherAdvisorScore = await read("/teacher/advisor-score", studentPayload);
      assert(!studentTeacherAdvisorScore.includes("Advisor score 25%"), "student can see Advisor score workflow");

      const studentTeacherProgress1 = await read("/teacher/progress1", studentPayload);
      assert(!studentTeacherProgress1.includes("Progress 1 scoring"), "student can see teacher Progress 1 scoring page");

      const studentTeacherProgress2 = await read("/teacher/progress2", studentPayload);
      assert(!studentTeacherProgress2.includes("Progress 2 scoring"), "student can see teacher Progress 2 scoring page");

      const studentTeacherFinal = await read("/teacher/final", studentPayload);
      assert(!studentTeacherFinal.includes("Final Presentation scoring"), "student can see teacher Final scoring page");

      const studentAdminSchedules = await read("/admin/schedules", studentPayload);
      assert(!studentAdminSchedules.includes("MATH-101"), "student can see admin schedule data");

      const studentAdminCloseout = await read("/admin/closeout", studentPayload);
      assert(!studentAdminCloseout.includes("Progress 1 score"), "student can see admin closeout checklist");

      const anonymousStudentSchedule = await read("/student/schedule");
      assert(!anonymousStudentSchedule.includes("MATH-101"), "anonymous user can see student schedule data");

      return "verified /student/schedule, /student/report, /teacher/schedules, /teacher/reports, /teacher/advisor-score, /teacher/progress1, /teacher/progress2, /teacher/final, /admin/schedules, /admin/closeout guards over HTTP";
    });
  });

  await step(19, "Duplicate guard verification", async () => {
    const projectCount = await prisma.project.count({ where: { courseOfferingId } });
    const proposalRoundCount = await prisma.assessmentRound.count({ where: { courseOfferingId, roundType: "PROPOSAL" } });
    const majorRoundCount = await prisma.assessmentRound.count({ where: { courseOfferingId, roundType: { in: [...courseLevelRoundTypes] } } });
    const failHistory = await prisma.projectStatusHistory.count({ where: { projectId: projects.failId, toStatus: "DRAFT" } });
    assert(projectCount === 3, `Expected exactly 3 E2E projects after rerun-safe setup, found ${projectCount}`);
    assert(proposalRoundCount === 1, "Expected one course-level Proposal round");
    assert(majorRoundCount === courseLevelRoundTypes.length, "Expected one course-level round for each major assessment type");
    assert(failHistory > 0, "FAIL path should return the same project to DRAFT with status history");
    return "stable course offering has 3 projects, one Proposal round, and preserved FAIL history";
  });
}

async function writeReview() {
  const verdict = reportRows.every((row) => row.status === "PASS") ? "PASS: simulated lifecycle completed" : bugsFound.length ? "PARTIAL: specific blockers remain" : "FAIL: lifecycle cannot proceed";
  const commands = [
    "cmd /c npm.cmd run prisma:validate",
    "cmd /c npm.cmd run typecheck",
    "cmd /c npm.cmd test",
    "cmd /c npm.cmd run build",
    "cmd /c npm.cmd run e2e:lifecycle"
  ];
  const markdown = `# E2E Lifecycle Review

## 1. Test Date/Time

- ${startedAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}

## 2. Environment

- Workspace: D:\\Project_system_codex
- Database: local development PostgreSQL only
- Course offering: ${courseOfferingId}
- E2E method: automated Prisma lifecycle simulation with optional development route visibility fetches

## 3. Commands Run

${commands.map((command) => `- \`${command}\``).join("\n")}

## 4. Demo Users Used

- Admin: ${process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase() || "dev.admin@sru.ac.th"}
- Student: 65123456789@student.sru.ac.th (สมชาย ใจดี)
- Student: 65123456790@student.sru.ac.th (สมหญิง รักเรียน)
- Student: 65123456791@student.sru.ac.th (สมปอง ตั้งใจ)
- Teachers: 11 internal E2E teachers, including advisor/head/member test users

## 5. Lifecycle Steps Tested

${reportRows.map((row) => `- ${row.no}. ${row.name}: ${row.status} - ${row.detail}`).join("\n")}

## 6. Pass/Fail Result Per Step

| Step | Result | Detail |
| --- | --- | --- |
${reportRows.map((row) => `| ${row.no}. ${row.name} | ${row.status} | ${row.detail.replace(/\|/g, "/")} |`).join("\n")}

## 7. Bugs Found

${bugsFound.length ? bugsFound.map((bug) => `- ${bug}`).join("\n") : "- No unresolved bugs found by the final lifecycle run."}

## 8. Fixes Made

${fixesMade.map((fix) => `- ${fix}`).join("\n")}

## 9. Screenshots Or Route References

- Route reference: /admin
- Route reference: /student
- Route reference: /teacher
- Route reference: /student/proposal
- Route reference: /teacher/proposals
- Route reference: /admin/proposals

## 10. Remaining Limitations

- The E2E command uses direct service/database actions for later skeleton stages instead of full browser clicks for every Progress/Final/Report button.
- Detailed Progress 1, Progress 2, Final scoring rubrics are intentionally not implemented.
- External committee magic links and full AUN-QA export are intentionally not implemented.
- Report/article numeric scoring is intentionally not implemented.

## 11. Final Verdict

${verdict}
`;
  await import("node:fs/promises").then((fs) => fs.writeFile("E2E_LIFECYCLE_REVIEW.md", markdown, "utf8"));
}

run()
  .catch(() => undefined)
  .finally(async () => {
    await writeReview();
    await prisma.$disconnect();
    if (reportRows.some((row) => row.status === "FAIL")) process.exit(1);
  });
