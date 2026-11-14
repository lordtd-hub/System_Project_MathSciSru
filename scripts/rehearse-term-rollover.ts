import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, realpath, rm, writeFile, mkdir, readdir, copyFile, unlink } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import type { AssessmentRoundType, AttemptType, CommitteeRole, PrismaClient } from "@prisma/client";

// No external URL/credentials accepted. Own fresh PostgreSQL process, synthetic data only.
async function main() {
  const app = resolve(process.cwd());
  const workspace = resolve(app, "..");
  const pg17 = process.argv.includes("--pg17");
  const fullUi = process.argv.includes("--full-ui");
  const pg = join(workspace, `portable-pg-runtime/${pg17 ? "v17.12-1" : "v16.15-5"}/pgsql/bin`);
  if (!existsSync(join(pg, "postgres.exe")) || !existsSync(join(app, "AGENTS.md"))) throw new Error("Expected trusted local runtime/app");
  for (const name of await readdir(app)) if ((name === ".env" || name.startsWith(".env.")) && name !== ".env.example") throw new Error("Refuse private environment files");
  const withUi = fullUi || process.argv.includes("--with-ui");
  if (process.argv.slice(2).some(arg => !["--with-ui", "--pg17", "--full-ui"].includes(arg))) throw new Error("No external configuration accepted");
  const runId = randomUUID(), password = randomBytes(32).toString("base64url");
  const root = await mkdtemp(join(workspace, "term-rehearsal-"));
  const data = join(root, "data"), marker = join(root, ".synthetic-owner"), pgLog = join(root, "postgres.log");
  await writeFile(marker, runId, { flag: "wx" });
  const identity = execFileSync("whoami.exe", ["/user", "/fo", "csv", "/nh"], { encoding: "utf8", windowsHide: true });
  const sid = identity.match(/S-1-\d+(?:-\d+)+/)?.[0];
  if (!sid) throw new Error("Cannot restrict test directory");
  execFileSync("icacls.exe", [root, "/inheritance:r", "/grant:r", `*${sid}:(OI)(CI)F`], { stdio: "pipe", windowsHide: true });
  const pwfile = join(root, ".pg-init-password");
  await writeFile(pwfile, password, { mode: 0o600, flag: "wx" });
  const port = await freePort(), uiPort = await freePort();
  const environment: NodeJS.ProcessEnv = { NODE_ENV: "test" };
  for (const name of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "COMSPEC", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "PATHEXT", "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE"]) if (process.env[name]) environment[name] = process.env[name];
  Object.assign(environment, { NODE_ENV: "test", TZ: "UTC", PGPASSWORD: password, PGSSLMODE: "disable", PGAPPNAME: "synthetic-term-rollover-only",
    AUTH_SECRET: randomBytes(32).toString("base64url"), AUTH_URL: `http://127.0.0.1:${uiPort}`, AUTH_TRUST_HOST: "true", INITIAL_ADMIN_EMAIL: "synthetic.owner@sru.ac.th",
    EMAIL_NOTIFICATIONS_ENABLED: "0", LINE_NOTIFICATIONS_ENABLED: "0", ENABLE_QA_LOGIN: "0", QA_LOGIN_ALLOW_PRODUCTION: "0", ENABLE_OWNER_PASSWORD_LOGIN: "0", PRISMA_HIDE_UPDATE_MESSAGE: "1", CHECKPOINT_DISABLE: "1" });
  const url = (database: string) => `postgresql://postgres:${password}@127.0.0.1:${port}/${database}?schema=public&connection_limit=8&sslmode=disable`;
  const envFor = (database: string) => ({ ...environment, DATABASE_URL: url(database), DIRECT_URL: url(database) });
  const clean = (value: string) => value.replaceAll(password, "<redacted synthetic password>").replaceAll(environment.AUTH_SECRET!, "<redacted synthetic secret>");
  const connection = ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres"];
  const cli = join(app, "node_modules/prisma/build/index.js");
  const prismaCommand = (args: string[], database: string) => execFileSync(process.execPath, [cli, ...args], { cwd: app, env: envFor(database), stdio: "pipe", encoding: "utf8", windowsHide: true, timeout: 120000 });
  const sql = (database: string, query: string) => execFileSync(join(pg, "psql.exe"), [...connection, "-d", database, "-v", "ON_ERROR_STOP=1", "-At", "-c", query], { cwd: pg, env: environment, stdio: "pipe", encoding: "utf8", windowsHide: true });
  const createDb = (database: string) => execFileSync(join(pg, "createdb.exe"), [...connection, database], { env: environment, stdio: "pipe", windowsHide: true });
  let started = false, web: ChildProcess | undefined, client: PrismaClient | undefined, webLog = "", stage = "initdb";
  const passed: string[] = [];
  const pass = (message: string) => { passed.push(message); console.log(`PASS: ${message}`); };
  try {
    execFileSync(join(pg, "initdb.exe"), ["-D", data, "-U", "postgres", "--encoding=UTF8", "--locale=C", "--auth-local=scram-sha-256", "--auth-host=scram-sha-256", `--pwfile=${pwfile}`], { cwd: pg, env: environment, stdio: "pipe", windowsHide: true });
    await unlink(pwfile);
    started = true;
    execFileSync(join(pg, "pg_ctl.exe"), ["-D", data, "-l", pgLog, "-o", `-h 127.0.0.1 -p ${port} -c max_connections=30`, "-w", "-t", "30", "start"], { env: environment, stdio: "ignore", windowsHide: true });
    check(sql("postgres", "SHOW listen_addresses").trim() === "127.0.0.1", "loopback only");
    sql("postgres", "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE synthetic_browser_group NOLOGIN;");
    createDb("term_rollover_main"); createDb("term_rollover_rollback"); createDb("term_rollover_inherited");
    const serverVersion = sql("postgres", "SHOW server_version").trim();
    check(serverVersion.startsWith(pg17 ? "17." : "16."), "expected PostgreSQL major");
    pass(`own PostgreSQL${serverVersion} process, random127.0.0.1 port, SCRAM, no service/production credentials`);
    stage = "migrations and new-table privacy";
    sql("term_rollover_main", "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;");
    prismaCommand(["migrate", "deploy"], "term_rollover_main");
    Object.assign(process.env, envFor("term_rollover_main"));
    const { prisma } = await import("../src/lib/db"); client = prisma;
    const migrationRows = await prisma.$queryRaw<Array<{ migration_name: string }>>`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    check(migrationRows.length === 9, "exact migration count");
    for (const table of ["project_academic_results", "incomplete_continuations"]) {
      const security = sql("term_rollover_main", `SELECT relrowsecurity FROM pg_class WHERE oid='public.${table}'::regclass; SELECT has_table_privilege('anon','public.${table}','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'); SELECT has_any_column_privilege('authenticated','public.${table}','SELECT,INSERT,UPDATE,REFERENCES');`).trim().split(/\r?\n/);
      check(security.join(",") === "t,f,f", "new table security after broad defaults");
      if (pg17) check(sql("term_rollover_main", `SELECT has_table_privilege('anon','public.${table}','MAINTAIN'); SELECT has_table_privilege('authenticated','public.${table}','MAINTAIN');`).trim().replace(/\r/g, "") === "f\nf", "PG17 broad-default MAINTAIN revoked");
    }
    pass("9 migrations recorded; both new tables have RLS and no inherited/direct browser CRUD despite broad defaults");
    // Empty rollback uses a separate disposable DB; no migration ledger is edited.
    prismaCommand(["migrate", "deploy"], "term_rollover_rollback");
    sql("term_rollover_rollback", await readFile(join(app, "scripts/sql/rollback-empty-term-results.local-only.sql"), "utf8"));
    check(sql("term_rollover_rollback", "SELECT to_regclass('public.project_academic_results') IS NULL; SELECT count(*) FROM information_schema.columns WHERE table_name='course_offerings' AND column_name IN ('course_code','section');").trim().replace(/\r/g, "") === "t\n0", "empty rollback");
    pass("empty local schema rollback removes only new objects/columns; existing schema remains");
    // Rehearse an inherited group grant: migration must abort transactionally.
    const baseline = join(root, "baseline"), baselineMigrations = join(baseline, "migrations");
    await mkdir(baselineMigrations, { recursive: true });
    await writeFile(join(baseline, "schema.prisma"), execFileSync("git", ["show", "1ae19603282ffc607fd034e2a55a4954410a8fbd:prisma/schema.prisma"], { cwd: app, stdio: "pipe" }));
    await copyFile(join(app, "prisma/migrations/migration_lock.toml"), join(baselineMigrations, "migration_lock.toml"));
    const migrationNames = (await readdir(join(app, "prisma/migrations"), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
    for (const name of migrationNames.slice(0, 8)) { await mkdir(join(baselineMigrations, name)); await copyFile(join(app, "prisma/migrations", name, "migration.sql"), join(baselineMigrations, name, "migration.sql")); }
    prismaCommand(["migrate", "deploy", "--schema", join(baseline, "schema.prisma")], "term_rollover_inherited");
    sql("term_rollover_inherited", "GRANT synthetic_browser_group TO anon; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO synthetic_browser_group;");
    await rejects(async () => sql("term_rollover_inherited", await readFile(join(app, "prisma/migrations/20261113160000_term_results_and_cohorts/migration.sql"), "utf8")), "inherited privilege must abort");
    check(sql("term_rollover_inherited", "SELECT to_regclass('public.project_academic_results') IS NULL; SELECT count(*) FROM information_schema.columns WHERE table_name='course_offerings' AND column_name='course_code';").trim().replace(/\r/g, "") === "t\n0", "failed migration rolls all DDL back");
    if (pg17) {
      sql("term_rollover_inherited", "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM synthetic_browser_group; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT MAINTAIN ON TABLES TO synthetic_browser_group;");
      let maintainDenied = false;
      try { sql("term_rollover_inherited", await readFile(join(app, "prisma/migrations/20261113160000_term_results_and_cohorts/migration.sql"), "utf8")); }
      catch (error) { maintainDenied = String((error as { stderr?: Buffer }).stderr ?? "").includes("Unexpected inherited browser maintenance privilege"); }
      check(maintainDenied && sql("term_rollover_inherited", "SELECT to_regclass('public.project_academic_results') IS NULL").trim() === "t", "PG17 MAINTAIN-only inherited grant aborts and rolls back DDL");
      pass("PostgreSQL17 MAINTAIN direct/default revoke and inherited-MAINTAIN-only fail-closed transactional rollback");
    }
    sql("term_rollover_inherited", "REVOKE synthetic_browser_group FROM anon;");
    pass("unexpected inherited browser grant fails closed and rolls all new DDL back");

    stage = "synthetic 10-student old cohort";
    const { openOfferingAtomic, importCohortAtomic } = await import("../src/lib/terms/offeringLifecycle");
    const { closeOfferingWithIncomplete, openIncompleteContinuation, resolveIncomplete } = await import("../src/lib/terms/incomplete");
    const { hasIncompleteRoundAccess } = await import("../src/lib/terms/incompleteAccess");
    const { saveAssessmentEvidenceAtomic, submitExamScheduleAtomic, submitReportVersionAtomic } = await import("../src/lib/projects/studentFutureStageMutations");
    const { persistPresentationScore } = await import("../src/lib/scoring/persistPresentationScore");
    const { getCourseGradeExportRows } = await import("../src/lib/evidence/adminEvidence");
    const admin = await prisma.user.create({ data: { id: "synthetic-admin", email: environment.INITIAL_ADMIN_EMAIL, name: "Synthetic Owner", globalRole: "ADMIN" } });
    const teachers: Array<{ id: string; userId: string; role: CommitteeRole }> = [];
    for (const role of ["ADVISOR", "HEAD", "MEMBER"] as const) {
      const user = await prisma.user.create({ data: { email: `synthetic.${role.toLowerCase()}@sru.ac.th`, name: `Synthetic ${role}`, globalRole: "TEACHER" } });
      const teacher = await prisma.teacher.create({ data: { userId: user.id, email: user.email, academicPrefix: "Dr.", firstNameTh: "Synthetic", lastNameTh: role } });
      teachers.push({ ...teacher, userId: user.id, role });
    }
    const input = (termType: "SEMESTER_1" | "SEMESTER_2", section: string) => ({ yearBe: 2569, termType, courseCode: "SMA6002", section, courseTitle: "SYNTHETIC project course", termDisplayName: termType === "SEMESTER_1" ? "ภาคเรียนที่ 1 ปีการศึกษา 2569 (จำลอง)" : "ภาคเรียนที่ 2 ปีการศึกษา 2569 (จำลอง)" });
    const old = await openOfferingAtomic(prisma, admin.id, input("SEMESTER_1", "N01"));
    const eCourse = await openOfferingAtomic(prisma, admin.id, input("SEMESTER_1", "E00"));
    const oldRows = Array.from({ length: 10 }, (_, index) => `${String(9900000000001 + index)},Synthetic,Student${index + 1}`);
    const csv = (rows: string[]) => "student_code,first_name_th,last_name_th\n" + rows.join("\n");
    await importCohortAtomic(prisma, admin.id, old.id, csv(oldRows));
    await importCohortAtomic(prisma, admin.id, eCourse.id, csv(["9700000000001,Synthetic,EOnly"]));
    const projects = await prisma.project.findMany({ where: { courseOfferingId: old.id }, include: { student: true }, orderBy: { student: { studentCode: "asc" } } });
    const rounds = await prisma.assessmentRound.findMany({ where: { courseOfferingId: old.id } });
    const round = (type: AssessmentRoundType) => rounds.find(item => item.roundType === type)!;
    const rubric = await prisma.rubric.create({ data: { roundType: "FINAL_PRESENTATION", name: "Synthetic only", items: { create: { groupKey: "test", groupLabelTh: "Synthetic", itemKey: "synthetic", itemLabelTh: "Synthetic only", points: 100, displayOrder: 1 } } }, include: { items: true } });
    for (let index = 0; index < projects.length; index++) {
      const project = projects[index];
      const user = await prisma.user.create({ data: { email: project.student.generatedEmail, name: `Synthetic Student${index + 1}`, globalRole: "STUDENT" } });
      await prisma.student.update({ where: { id: project.studentId }, data: { userId: user.id } });
      for (const teacher of teachers) await prisma.committeeAssignment.create({ data: { projectId: project.id, teacherId: teacher.id, role: teacher.role, appointedByUserId: admin.id } });
      await prisma.advisorRequest.create({ data: { projectId: project.id, studentId: project.studentId, advisorTeacherId: teachers[0].id, status: "APPROVED", reviewedAt: new Date() } });
      for (const type of ["PROPOSAL", "PROGRESS_1", ...(index < 8 ? ["PROGRESS_2", "FINAL_PRESENTATION"] : [])] as AssessmentRoundType[]) {
        const attempt = await prisma.assessmentAttempt.create({ data: { projectId: project.id, assessmentRoundId: round(type).id, attemptNo: 1, attemptType: type === "PROPOSAL" ? "MAIN_PROPOSAL" : type as AttemptType, status: "SCORING_CLOSED" } });
        for (const teacher of teachers.slice(1)) {
          const assignment = await prisma.evaluatorAssignment.create({ data: { assessmentAttemptId: attempt.id, evaluatorUserId: teacher.userId, teacherId: teacher.id, evaluatorDisplayNameSnapshot: `Synthetic ${teacher.role}`, status: "SUBMITTED", isRequired: true } });
          await prisma.scoreSubmission.create({ data: { evaluatorAssignmentId: assignment.id, status: "SUBMITTED", totalScore: 85 + index, submittedAt: new Date("2026-10-19T00:00:00Z"), scoreItems: { create: { rubricItemId: rubric.items[0].id, pointsAwarded: 85 + index, checked: true } } } });
        }
      }
      await prisma.project.update({ where: { id: project.id }, data: { status: index < 8 ? "COMPLETED" : "IN_PROGRESS", currentTitleTh: `Synthetic Project ${index + 1}` } });
      if (index === 9) await prisma.assessmentSubmission.create({ data: { projectId: project.id, studentId: project.studentId, kind: "PROGRESS_2", materialLink: "https://drive.google.com/file/d/synthetic-existing-p2/view", submittedAt: new Date("2026-10-08T14:28:36.372Z") } });
      if (index < 8) {
        const report = await prisma.reportVersion.create({ data: { projectId: project.id, submittedByStudentId: project.studentId, versionNo: 1, driveLink: "https://drive.google.com/file/d/synthetic/view" } });
        for (const teacher of teachers.slice(1)) await prisma.reportReview.create({ data: { reportVersionId: report.id, reviewerTeacherId: teacher.id, decision: "PASS", comment: "Synthetic retained evidence" } });
        await prisma.advisorScore.create({ data: { projectId: project.id, advisorTeacherId: teachers[0].id, status: "SUBMITTED", score: 100, responsibilityScore: 25, researchProcessScore: 25, problemSolvingScore: 25, communicationScore: 15, professionalismScore: 10, submittedAt: new Date() } });
      }
      if (index < 3) {
        const schedule = await prisma.examScheduleProposal.create({ data: { projectId: project.id, courseOfferingId: old.id, assessmentRoundId: round("FINAL_PRESENTATION").id, roundType: "FINAL_PRESENTATION", assessmentKind: "FINAL_PRESENT", proposedByStudentId: project.studentId, proposedStartAt: new Date("2026-10-19T02:00:00Z"), status: "CONFIRMED" } });
        for (const teacher of teachers) await prisma.examScheduleApproval.create({ data: { scheduleProposalId: schedule.id, teacherId: teacher.id, decision: "APPROVE", decidedAt: new Date("2026-10-13T02:00:00Z") } });
        await prisma.projectTimelineEvent.create({ data: { projectId: project.id, eventType: "SYNTHETIC_RESCHEDULE_HISTORY", eventTitle: "Synthetic retained 19 October schedule", actorUserId: admin.id } });
      }
    }
    await prisma.assessmentRound.updateMany({ where: { courseOfferingId: old.id }, data: { status: "SCORING_CLOSED", closedAt: new Date("2026-10-19T00:00:00Z") } });
    const oldIds = projects.map(project => project.id), iProjects = projects.slice(8);
    async function oldEvidence() {
      return JSON.stringify(await prisma.project.findMany({ where: { id: { in: oldIds } }, orderBy: { id: "asc" }, include: {
        attempts: { orderBy: { id: "asc" }, include: { evaluatorAssignments: { orderBy: { id: "asc" }, include: { scoreSubmission: { include: { scoreItems: { orderBy: { id: "asc" } } } } } } } },
        scheduleProposals: { orderBy: { id: "asc" }, include: { approvals: { orderBy: { id: "asc" } } } }, assessmentSubmissions: { orderBy: { id: "asc" } }, reportVersions: { orderBy: { id: "asc" }, include: { reviews: { orderBy: { id: "asc" } } } }, advisorScore: true, committeeAssignments: { orderBy: { id: "asc" } }
      } }));
    }
    const before = await oldEvidence(), beforeGradeRows = await getCourseGradeExportRows(old.id);
    const closing = { actorId: admin.id, offeringId: old.id, expectedProjectIds: oldIds, decisions: iProjects.map(project => ({ projectId: project.id, grade: "I" as const, reason: "Synthetic instructor grants more time; no numeric score invented" })), reason: "Synthetic closure only", reference: "SYNTHETIC-CLOSED-RESULTS-ONLY" };
    await rejects(() => closeOfferingWithIncomplete(prisma, { ...closing, actorId: teachers[1].userId }), "teacher cannot close course");
    await rejects(() => closeOfferingWithIncomplete(prisma, { ...closing, decisions: [] }), "no automatic I/E choice");
    await rejects(() => closeOfferingWithIncomplete(prisma, { ...closing, expectedProjectIds: oldIds.slice(1) }), "stale roster denied");
    const closeRace = await Promise.all([closeOfferingWithIncomplete(prisma, closing), closeOfferingWithIncomplete(prisma, closing)]);
    check(closeRace.filter(result => !result.unchanged).length === 1, "one closeout commit");
    check(await prisma.projectAcademicResult.count() === 2, "exact I rows");
    check(await oldEvidence() === before, "old scores/projects/reports/schedules/3-of-3 approvals retained byte-for-byte");
    const afterGradeRows = await getCourseGradeExportRows(old.id);
    check(afterGradeRows.every((row, index) => row.recordedTotalScore === beforeGradeRows[index].recordedTotalScore), "no weighting/recalculation");
    check(afterGradeRows.filter(row => row.academicResultCode === "I").length === 2, "export I overlay");
    pass("10 old projects: I2 only, completed8 untouched; concurrent close is idempotent, actual scores/reports/reschedules/approvals retained");
    const eProject = await prisma.project.findFirstOrThrow({ where: { courseOfferingId: eCourse.id } });
    await closeOfferingWithIncomplete(prisma, { actorId: admin.id, offeringId: eCourse.id, expectedProjectIds: [eProject.id], decisions: [{ projectId: eProject.id, grade: "E", reason: "Synthetic explicit instructor E" }], reason: "Synthetic E", reference: "SYNTHETIC-E-DECISION" });
    check((await prisma.project.findUniqueOrThrow({ where: { id: eProject.id } })).status === "STUDENT_PROFILE", "E is not fake COMPLETED");
    check((await prisma.term.findUniqueOrThrow({ where: { id: (await prisma.courseOffering.findUniqueOrThrow({ where: { id: old.id } })).termId } })).status === "CLOSED", "term closes after all sibling offerings");
    pass("explicit E creates no zero/completed state; term closes only after sibling offerings close");
    stage = "new term and duplicate-click/race import";
    const newRace = await Promise.all([openOfferingAtomic(prisma, admin.id, input("SEMESTER_2", "P01")), openOfferingAtomic(prisma, admin.id, input("SEMESTER_2", "P01"))]);
    check(newRace[0].id === newRace[1].id && newRace.filter(result => !result.unchanged).length === 1, "one new offering");
    const next = newRace[0];
    const newCsv = csv([oldRows[9], ...Array.from({ length: 6 }, (_, index) => `${9800000000001 + index},Synthetic,New${index + 1}`)]);
    const imports = await Promise.all([importCohortAtomic(prisma, admin.id, next.id, newCsv), importCohortAtomic(prisma, admin.id, next.id, newCsv)]);
    check(imports.reduce((sum, result) => sum + result.createdProjects, 0) === 7, "7 synthetic new enrollments once");
    check(await prisma.project.count({ where: { courseOfferingId: next.id } }) === 7, "new cohort 7");
    check(await prisma.project.count({ where: { studentId: iProjects[1].studentId } }) === 2, "same student has separate term projects");
    check(await oldEvidence() === before, "new term does not change old evidence");
    await rejects(() => importCohortAtomic(prisma, admin.id, old.id, newCsv), "closed import denied");
    await rejects(() => importCohortAtomic(prisma, admin.id, next.id, csv(["9600000000001,Synthetic,Rollback", "9900000000010,Wrong,Identity"])), "identity overwrite denied");
    check(!await prisma.student.findUnique({ where: { studentCode: "9600000000001" } }), "partial import rolled back");
    pass("new2/2569 P01 synthetic7 isolated; reused student identity retained; duplicate/racing imports and partial-failure rollback verified");

    stage = "successive late enrollment imports after an offering is already open";
    const lateInput = { ...input("SEMESTER_1", "L01"), yearBe: 2570, termDisplayName: "Synthetic late-enrollment test only" };
    const late = await openOfferingAtomic(prisma, admin.id, lateInput);
    const firstRow = "9500000000001,Synthetic,LateOne";
    check((await importCohortAtomic(prisma, admin.id, late.id, csv([firstRow]))).createdProjects === 1, "initial import after empty opening");
    const firstStudent = await prisma.student.findUniqueOrThrow({ where: { studentCode: "9500000000001" } });
    const firstProject = await prisma.project.findUniqueOrThrow({ where: { courseOfferingId_studentId: { courseOfferingId: late.id, studentId: firstStudent.id } } });
    await prisma.project.update({ where: { id: firstProject.id }, data: { currentTitleTh: "Synthetic existing project evidence must remain" } });
    const retainedFirstProject = JSON.stringify(await prisma.project.findUniqueOrThrow({ where: { id: firstProject.id } }));
    const laterRows = [firstRow, "9500000000002,Synthetic,LateTwo"];
    check((await importCohortAtomic(prisma, admin.id, late.id, csv(laterRows))).createdProjects === 1, "later import adds only the new student");
    check(JSON.stringify(await prisma.project.findUniqueOrThrow({ where: { id: firstProject.id } })) === retainedFirstProject, "later import retains initial project fields and ID");
    const repeat = await importCohortAtomic(prisma, admin.id, late.id, csv(laterRows));
    check(repeat.createdProjects === 0 && repeat.unchanged, "later duplicate import is unchanged");
    const racingLateRows = csv([...laterRows, "9500000000003,Synthetic,LateThree"]);
    const lateRace = await Promise.all([importCohortAtomic(prisma, admin.id, late.id, racingLateRows), importCohortAtomic(prisma, admin.id, late.id, racingLateRows)]);
    check(lateRace.reduce((sum, result) => sum + result.createdProjects, 0) === 1 && await prisma.project.count({ where: { courseOfferingId: late.id } }) === 3, "concurrent later import creates one enrollment only");
    const studentActor = await prisma.user.create({ data: { email: "synthetic.late.student@student.sru.ac.th", name: "Synthetic student actor", globalRole: "STUDENT" } });
    const deniedCsv = csv(["9500000000004,Synthetic,Denied"]);
    await rejects(() => importCohortAtomic(prisma, teachers[1].userId, late.id, deniedCsv), "teacher cannot add late enrollment");
    await rejects(() => importCohortAtomic(prisma, studentActor.id, late.id, deniedCsv), "student cannot add late enrollment");
    const laterTerm = await openOfferingAtomic(prisma, admin.id, { ...lateInput, termType: "SEMESTER_2", section: "L02" });
    check((await importCohortAtomic(prisma, admin.id, laterTerm.id, csv([firstRow]))).createdProjects === 1, "same student can enroll separately in another term");
    const laterProject = await prisma.project.findUniqueOrThrow({ where: { courseOfferingId_studentId: { courseOfferingId: laterTerm.id, studentId: firstStudent.id } } });
    check(laterProject.id !== firstProject.id && laterProject.studentId === firstStudent.id, "same Student ID, separate Project IDs");
    // Fixture state only: this tests the import gate, not the academic-result closing workflow.
    await prisma.courseOffering.update({ where: { id: late.id }, data: { status: "CLOSED" } });
    await rejects(() => importCohortAtomic(prisma, admin.id, late.id, deniedCsv), "even admin cannot import into closed offering");
    check(!await prisma.student.findUnique({ where: { studentCode: "9500000000004" } }), "denied imports create no student");
    check(JSON.stringify(await prisma.project.findUniqueOrThrow({ where: { id: firstProject.id } })) === retainedFirstProject && await oldEvidence() === before, "late and cross-term imports retain all original project/score/report/schedule evidence");
    pass("successive late import: first then new/duplicate/racing additions, same student across terms, teacher/student/closed denial and old evidence retention");
    stage = "I continuation policy and actor/term permission guards";
    const noPenalty = { actorId: admin.id, projectId: iProjects[0].id, roundId: round("PROGRESS_2").id, expectedVersion: 1, reason: "Synthetic continuation", reference: "SYNTHETIC-EXPLICIT-POLICY", penaltyDecision: "NO_ADDITIONAL_PENALTY" as const };
    await rejects(() => openIncompleteContinuation(prisma, { ...noPenalty, actorId: teachers[1].userId }), "only admin opens continuation");
    const foreignRound = await prisma.assessmentRound.findFirstOrThrow({ where: { courseOfferingId: next.id, roundType: "PROGRESS_2" } });
    await rejects(() => openIncompleteContinuation(prisma, { ...noPenalty, roundId: foreignRound.id }), "cross-term continuation denied");
    await rejects(() => openIncompleteContinuation(prisma, { ...noPenalty, projectId: eProject.id }), "E does not acquire I access");
    await rejects(() => openIncompleteContinuation(prisma, { ...noPenalty, roundId: round("PROGRESS_1").id }), "already scored round cannot reopen through I");
    const continuationRace = await Promise.all([openIncompleteContinuation(prisma, noPenalty), openIncompleteContinuation(prisma, noPenalty)]);
    check(continuationRace.filter(result => !result.unchanged).length === 1, "one continuation grant");
    check(await prisma.projectRoundException.count() === 0, "I never creates a late exception");
    const penaltyFlag = await prisma.projectRoundException.create({ data: { projectId: iProjects[1].id, assessmentRoundId: round("PROGRESS_2").id, exceptionType: "LATE_ASSESSMENT_ROUND", reason: "Synthetic existing true penalty", status: "OPEN" } });
    await rejects(() => openIncompleteContinuation(prisma, { ...noPenalty, projectId: iProjects[1].id }), "I cannot waive true existing penalty");
    await openIncompleteContinuation(prisma, { ...noPenalty, projectId: iProjects[1].id, penaltyDecision: "PRESERVE_EXISTING" });
    check((await prisma.projectRoundException.findUniqueOrThrow({ where: { id: penaltyFlag.id } })).status === "OPEN", "penalty retained");
    pass("I access is separate from late flags; explicit policy/reference required only for continuation; real penalty retained, teacher/E/cross-term misuse denied");
    const student = await prisma.student.findUniqueOrThrow({ where: { id: iProjects[0].studentId } });
    const context = { userId: student.userId!, studentId: student.id, projectId: iProjects[0].id, studentCode: student.studentCode, studentFirstNameTh: student.firstNameTh, studentLastNameTh: student.lastNameTh };
    const evidence = { kind: "PROGRESS_2" as const, roundType: "PROGRESS_2" as const, title: "Synthetic", materialLink: "https://drive.google.com/file/d/synthetic/view", contentJson: { progress: "Synthetic work" }, summary: "Synthetic evidence" };
    await rejects(() => saveAssessmentEvidenceAtomic(prisma, { ...context, studentId: iProjects[1].studentId }, evidence), "other student cannot write old I");
    await saveAssessmentEvidenceAtomic(prisma, context, evidence);
    check((await saveAssessmentEvidenceAtomic(prisma, context, evidence)).unchanged, "same evidence no duplicate");
    const scheduled = await submitExamScheduleAtomic(prisma, context, { roundType: "PROGRESS_2", assessmentKind: "PROGRESS_2", start: new Date("2026-11-30T02:00:00Z"), end: new Date("2026-11-30T03:00:00Z"), room: "Synthetic room", note: "Synthetic only" });
    check((await prisma.examScheduleProposal.findUniqueOrThrow({ where: { id: scheduled.scheduleId } })).status === "PROPOSED", "committee approval remains required");
    const { scheduleRoundAccessWhere } = await import("../src/lib/terms/scheduleAccessWhere");
    const pendingContinuedSchedule = { AND: [{ id: scheduled.scheduleId, status: "PROPOSED" as const, approvals: { some: { teacherId: teachers[1].id, decision: "PENDING" as const } } }, scheduleRoundAccessWhere()] };
    check(await prisma.examScheduleProposal.count({ where: pendingContinuedSchedule }) === 1, "dashboard includes authorized I pending approval on globally CLOSED round");
    await prisma.incompleteContinuation.update({ where: { projectId_assessmentRoundId: { projectId: context.projectId, assessmentRoundId: round("PROGRESS_2").id } }, data: { status: "RESOLVED", resolvedAt: new Date() } });
    check(await prisma.examScheduleProposal.count({ where: pendingContinuedSchedule }) === 0, "revoked I grant disappears from dashboard availability");
    await prisma.incompleteContinuation.update({ where: { projectId_assessmentRoundId: { projectId: context.projectId, assessmentRoundId: round("PROGRESS_2").id } }, data: { status: "OPEN", resolvedAt: null } });
    pass("dashboard pending schedule query includes authorized I only and excludes revoked grant on CLOSED round");
    await prisma.examScheduleApproval.updateMany({ where: { scheduleProposalId: scheduled.scheduleId }, data: { decision: "APPROVE", decidedAt: new Date() } });
    await prisma.examScheduleProposal.update({ where: { id: scheduled.scheduleId }, data: { status: "CONFIRMED" } }); // synthetic committee fixture, not a bypass in app code
    const scoreInput = (projectId: string, teacher: typeof teachers[number], type: "PROGRESS_2" | "FINAL_PRESENTATION") => ({
      requestId: randomUUID(), actorUserId: teacher.userId, teacherId: teacher.id, evaluatorDisplayName: `Synthetic ${teacher.role}`, projectId, assessmentRoundId: round(type).id,
      roundType: type, attemptType: type as AttemptType, assessmentKind: type === "PROGRESS_2" ? "PROGRESS_2" as const : "FINAL_PRESENT" as const,
      allowedProjectStatuses: ["IN_PROGRESS" as const, "FINAL_DONE" as const], rawTotalScore: 100, overallComment: "Synthetic actual submission",
      items: [{ id: rubric.items[0].id, itemKey: "synthetic", checked: true, pointsAwarded: 100 }], eventType: "SYNTHETIC_SCORE", createEventTitle: "Synthetic score", updateEventTitle: "Synthetic correction", auditAction: "SYNTHETIC_SCORE", completeFinalWhenReady: type === "FINAL_PRESENTATION"
    });
    const lateSchedule = await prisma.examScheduleProposal.create({ data: { projectId: iProjects[1].id, courseOfferingId: old.id, assessmentRoundId: round("PROGRESS_2").id, roundType: "PROGRESS_2", assessmentKind: "PROGRESS_2", proposedByStudentId: iProjects[1].studentId, proposedStartAt: new Date("2026-12-02T00:00:00Z"), status: "CONFIRMED" } });
    for (const teacher of teachers) await prisma.examScheduleApproval.create({ data: { scheduleProposalId: lateSchedule.id, teacherId: teacher.id, decision: "APPROVE" } });
    await persistPresentationScore(scoreInput(iProjects[1].id, teachers[1], "PROGRESS_2"));
    const lateScore = await prisma.scoreSubmission.findFirstOrThrow({ where: { evaluatorAssignment: { teacherId: teachers[1].id, assessmentAttempt: { projectId: iProjects[1].id, assessmentRoundId: round("PROGRESS_2").id } } } });
    check(Number(lateScore.totalScore) === 90, "existing true 10% penalty remains on I continuation");
    // Match the existing approved admin exception workflow: change the same flag,
    // rather than inventing coexistence/precedence rules for two OPEN flags.
    await prisma.projectRoundException.update({ where: { id: penaltyFlag.id }, data: { exceptionType: "EXCUSED_LATE_ASSESSMENT_ROUND", reason: "Synthetic separately authorized force majeure", reopenedById: admin.id, reopenedAt: new Date() } });
    await prisma.auditLog.create({ data: { actorUserId: admin.id, action: "SYNTHETIC_APPROVED_FORCE_MAJEURE", entityType: "ProjectRoundException", entityId: penaltyFlag.id, beforeJson: { exceptionType: "LATE_ASSESSMENT_ROUND" }, afterJson: { exceptionType: "EXCUSED_LATE_ASSESSMENT_ROUND" } } });
    await persistPresentationScore(scoreInput(iProjects[1].id, teachers[2], "PROGRESS_2"));
    const excusedScore = await prisma.scoreSubmission.findFirstOrThrow({ where: { evaluatorAssignment: { teacherId: teachers[2].id, assessmentAttempt: { projectId: iProjects[1].id, assessmentRoundId: round("PROGRESS_2").id } } } });
    check(Number(excusedScore.totalScore) === 100 && Number((await prisma.scoreSubmission.findUniqueOrThrow({ where: { id: lateScore.id } })).totalScore) === 90, "separately approved force-majeure flag is respected without recalculating earlier scores");
    pass("actual continued I scoring retains existing10% penalty and separately authorized force-majeure exemption; pre-existing Progress2 material preserved");
    await rejects(() => persistPresentationScore(scoreInput(context.projectId, teachers[0], "PROGRESS_2")), "advisor is not a presentation evaluator");
    const wrongRound = await prisma.assessmentRound.findFirstOrThrow({ where: { courseOfferingId: next.id, roundType: "PROGRESS_2" } });
    await rejects(() => persistPresentationScore({ ...scoreInput(context.projectId, teachers[1], "PROGRESS_2"), assessmentRoundId: wrongRound.id }), "cross-term numeric score denied");
    const score = scoreInput(context.projectId, teachers[1], "PROGRESS_2");
    await persistPresentationScore(score);
    check((await persistPresentationScore(score)).unchanged, "score replay no duplicate");
    await persistPresentationScore(scoreInput(context.projectId, teachers[2], "PROGRESS_2"));
    check((await prisma.project.findUniqueOrThrow({ where: { id: context.projectId } })).status === "IN_PROGRESS", "P2 does not fabricate Final completion");
    await rejects(() => resolveIncomplete(prisma, { actorId: admin.id, projectId: context.projectId, expectedVersion: 1, grade: "A", reference: "Synthetic final grade", reason: "not ready" }), "I cannot resolve before work complete");
    await openIncompleteContinuation(prisma, { ...noPenalty, roundId: round("FINAL_PRESENTATION").id });
    const finalSchedule = await prisma.examScheduleProposal.create({ data: { projectId: context.projectId, courseOfferingId: old.id, assessmentRoundId: round("FINAL_PRESENTATION").id, roundType: "FINAL_PRESENTATION", assessmentKind: "FINAL_PRESENT", proposedStartAt: new Date("2026-12-01T00:00:00Z"), proposedByStudentId: student.id, status: "CONFIRMED" } });
    for (const teacher of teachers) await prisma.examScheduleApproval.create({ data: { scheduleProposalId: finalSchedule.id, teacherId: teacher.id, decision: "APPROVE" } });
    await persistPresentationScore(scoreInput(context.projectId, teachers[1], "FINAL_PRESENTATION"));
    check((await prisma.project.findUniqueOrThrow({ where: { id: context.projectId } })).status === "IN_PROGRESS", "closed global round cannot mark missing committee complete");
    await persistPresentationScore(scoreInput(context.projectId, teachers[2], "FINAL_PRESENTATION"));
    check((await prisma.project.findUniqueOrThrow({ where: { id: context.projectId } })).status === "FINAL_DONE", "real final committee evidence completes exam");
    // Exercise actual post-Final report/revision services with the old course CLOSED.
    const reportInput = { driveLink: "https://drive.google.com/file/d/synthetic-resolution/view", note: "Synthetic report after Final" };
    const firstReport = await submitReportVersionAtomic(prisma, context, reportInput);
    check((await submitReportVersionAtomic(prisma, context, reportInput)).unchanged, "report replay is idempotent");
    await prisma.reportReview.create({ data: { reportVersionId: firstReport.reportVersionId, reviewerTeacherId: teachers[1].id, decision: "FAIL" } });
    const revisedReport = await submitReportVersionAtomic(prisma, context, { driveLink: "https://drive.google.com/file/d/synthetic-revision/view", note: "Synthetic revision requested" });
    const report = await prisma.reportVersion.findUniqueOrThrow({ where: { id: revisedReport.reportVersionId } });
    check(report.versionNo === 2 && await prisma.reportVersion.count({ where: { projectId: context.projectId } }) === 2, "post-Final revision retains original report version");
    pass("actual post-Final I report submission/replay/revision on CLOSED old course retains all report versions");
    // The existing teacher review and admin closeout UI are separate fixtures here.
    for (const teacher of teachers.slice(1)) await prisma.reportReview.create({ data: { reportVersionId: report.id, reviewerTeacherId: teacher.id, decision: "PASS" } });
    await prisma.advisorScore.create({ data: { projectId: context.projectId, advisorTeacherId: teachers[0].id, status: "SUBMITTED", score: 100, responsibilityScore: 25, researchProcessScore: 25, problemSolvingScore: 25, communicationScore: 15, professionalismScore: 10 } });
    await prisma.project.update({ where: { id: context.projectId }, data: { status: "COMPLETED" } });
    const resolution = { actorId: admin.id, projectId: context.projectId, expectedVersion: 1, grade: "A", reference: "SYNTHETIC-MANUALLY-CONFIRMED-GRADE", reason: "Synthetic verified resolution" };
    const resolutions = await Promise.all([resolveIncomplete(prisma, resolution), resolveIncomplete(prisma, resolution)]);
    check(resolutions.filter(result => !result.unchanged).length === 1, "single resolution event");
    const resolved = await prisma.projectAcademicResult.findUniqueOrThrow({ where: { projectId: context.projectId } });
    check(resolved.version === 2 && resolved.originalGrade === "I" && resolved.reference === closing.reference && resolved.resolutionGrade === "A", "original I/reference preserved");
    check(!await hasIncompleteRoundAccess(prisma, context.projectId, round("FINAL_PRESENTATION").id), "resolved continuation revoked");
    await rejects(() => openIncompleteContinuation(prisma, noPenalty), "resolved I cannot regain old continuation");
    await rejects(async () => sql("term_rollover_main", await readFile(join(app, "scripts/sql/rollback-empty-term-results.local-only.sql"), "utf8")), "data-bearing schema rollback refuses to delete history");
    await rejects(async () => sql("term_rollover_main", `UPDATE project_academic_results SET status='RESOLVED',version=2,resolved_at=now(),resolution_grade=NULL,resolution_reason='x',resolution_reference='x' WHERE project_id='${iProjects[1].id}'`), "DB constraint rejects null resolution");
    pass("cross-student/teacher/course guards; continued submission/scoring and replay; no fake exam completion; I resolution CAS/history/version and nonempty rollback refusal");
    // RLS still denies disclosure even if a client receives SELECT accidentally.
    const rlsResult = sql("term_rollover_main", "BEGIN; GRANT SELECT ON project_academic_results TO anon; SET LOCAL ROLE anon; SELECT count(*) FROM project_academic_results; ROLLBACK;");
    check(rlsResult.split(/\r?\n/).includes("0"), "RLS exposes zero result rows even with accidental SELECT");
    await rejects(async () => sql("term_rollover_main", "BEGIN; SET LOCAL ROLE anon; SELECT count(*) FROM project_academic_results; ROLLBACK;"), "browser table remains ungranted");
    pass("RLS blocks synthetic result disclosure; temporary SELECT rolled back, browser role remains ungranted");
    const { adminProposalDecisionScope, adminNotificationScope } = await import("../src/lib/admin/dashboardScope");
    check(await prisma.assessmentAttempt.count({ where: adminProposalDecisionScope(old.id) }) > 0, "old proposal evidence supplies a positive cross-term regression");
    check(await prisma.assessmentAttempt.count({ where: adminProposalDecisionScope(next.id) }) === 0, "new-term dashboard excludes old proposal decision counts");
    check(await prisma.notification.count({ where: adminNotificationScope(old.id) }) > 0, "old project notifications exist for cross-term regression");
    check(await prisma.notification.count({ where: adminNotificationScope(next.id) }) === 0, "new-term dashboard excludes old project notifications");
    pass("admin proposal queue and project notifications use the selected offering; old positive/new negative database regression");
    if (pg17) await writeFile(join(workspace, "staff-controls-postgres17-core-verification.json"), JSON.stringify({ utc: new Date().toISOString(), runId, serverVersion, passed, syntheticOnly: true, productionConnections: 0, emailsSent: 0, uiCompleted: false, migrationSHA256: createHash("sha256").update(await readFile(join(app, "prisma/migrations/20261113160000_term_results_and_cohorts/migration.sql"))).digest("hex") }, null, 2));
    if (withUi) {
      const uiTools = fullUi ? await import("./term-ui-fixture") : null;
      const scenario = uiTools ? await uiTools.prepareFullUiFixture(prisma, admin.id, teachers) : null;
      stage = "local UI server";
      web = spawn(process.execPath, [join(app, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(uiPort)], { cwd: app, env: { ...envFor("term_rollover_main"), NODE_ENV: "development" }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
      web.stdout?.on("data", chunk => { webLog += clean(String(chunk)); }); web.stderr?.on("data", chunk => { webLog += clean(String(chunk)); });
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt++) { if (web.exitCode !== null) throw new Error("Local UI server exited"); try { if ((await fetch(`http://127.0.0.1:${uiPort}/dev-login`)).ok) { ready = true; break; } } catch { /* Wait for the owned local server only. */ } await pause(500); }
      check(ready, "local UI ready");
      const stop = join(root, "ui-complete");
      const checkFile = join(root, "ui-check");
      await writeFile(join(workspace, "staff-controls-local-ui-session.json"), JSON.stringify({ runId, url: `http://127.0.0.1:${uiPort}`, stopFile: stop, checkFile, scenario, oldOfferingId: old.id, newOfferingId: next.id, oldIProjectId: iProjects[1].id, oldIStudentId: iProjects[1].studentId, resolvedIProjectId: context.projectId, resolvedIStudentId: context.studentId, teacherIds: teachers.map(teacher => ({ id: teacher.id, role: teacher.role })), syntheticOnly: true }, null, 2));
      console.log("UI_READY: see staff-controls-local-ui-session.json (no credentials); local server only, QA disabled.");
      for (let attempt = 0; attempt < (fullUi ? 7200 : 2400); attempt++) {
        if (scenario && uiTools && existsSync(checkFile)) {
          await unlink(checkFile);
          try { await writeFile(join(workspace, "staff-controls-term-full-ui-progress.json"), JSON.stringify(await uiTools.verifyFullUiFixture(prisma, scenario), null, 2)); }
          catch (error) { await writeFile(join(workspace, "staff-controls-term-full-ui-progress.json"), JSON.stringify({ passed: false, stage: String((error as Error).message), syntheticOnly: true }, null, 2)); }
        }
        if (existsSync(stop)) break;
        if (attempt === (fullUi ? 7199 : 2399)) throw new Error("UI test window expired"); await pause(500);
      }
      if (scenario && uiTools) {
        await writeFile(join(workspace, "staff-controls-term-full-ui-verification.json"), JSON.stringify({ utc: new Date().toISOString(), runId, ...await uiTools.verifyFullUiFixture(prisma, scenario) }, null, 2));
        pass("full actual browser I/E closure, continuation,6 committee approvals,4 scores,2 report versions/3 passes,advisor score,Admin closeout and explicit I resolution; pre-existing scores preserved");
      }
      pass("local UI inspection window completed");
    }
    await writeFile(join(workspace, pg17 ? "staff-controls-postgres17-verification.json" : "staff-controls-postgres-verification.json"), JSON.stringify({ utc: new Date().toISOString(), runId, serverVersion, passed, syntheticOnly: true, productionConnections: 0, emailsSent: 0, uiRequested: withUi, fullBrowserWorkflowRequested: fullUi, migration: "20261113160000_term_results_and_cohorts", migrationSHA256: createHash("sha256").update(await readFile(join(app, "prisma/migrations/20261113160000_term_results_and_cohorts/migration.sql"))).digest("hex") }, null, 2));
  } catch (error) {
    const value = error as { message?: string; code?: string; stderr?: Buffer };
    console.error(`FAIL at ${stage}: ${clean(String(value.code ?? value.message ?? "unknown"))}`);
    if (value.stderr) await writeFile(join(workspace, "staff-controls-term-postgres-error.log"), clean(value.stderr.toString("utf8")));
    process.exitCode = 1;
  } finally {
    if (web && web.exitCode === null && web.pid) { try { execFileSync("taskkill.exe", ["/PID", String(web.pid), "/T", "/F"], { stdio: "pipe", windowsHide: true }); } catch { process.exitCode = 1; } }
    await client?.$disconnect().catch(() => undefined);
    let safelyStopped = !started;
    if (started) { try { execFileSync(join(pg, "pg_ctl.exe"), ["-D", data, "-m", "fast", "-w", "-t", "30", "stop"], { stdio: "pipe", windowsHide: true }); safelyStopped = true; } catch { process.exitCode = 1; console.error("Test database stop requires attention; retaining directory."); } }
    const actualRoot = await realpath(root), actualWorkspace = await realpath(workspace);
    check(actualRoot.toLowerCase().startsWith(`${actualWorkspace}${sep}`.toLowerCase()) && basename(actualRoot).startsWith("term-rehearsal-") && await readFile(marker, "utf8") === runId, "bounded synthetic cleanup");
    if (existsSync(pgLog)) await writeFile(join(workspace, "staff-controls-term-postgres-server.log"), clean(await readFile(pgLog, "utf8")));
    await writeFile(join(workspace, "staff-controls-term-local-web.log"), clean(webLog));
    if (safelyStopped) {
      await rm(actualRoot, { recursive: true, force: true });
      console.log("CLEANUP: stopped only own test processes; removed nonce-verified synthetic database directory; sanitized logs retained.");
    }
  }
}
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function rejects(operation: () => Promise<unknown>, message: string) { let denied = false; try { await operation(); } catch { denied = true; } check(denied, message); }
async function freePort() { const server = createServer(); await new Promise<void>((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); }); const address = server.address(); if (!address || typeof address === "string") throw new Error("No loopback port"); await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done())); return address.port; }
main().catch(() => { console.error("Local synthetic rehearsal stopped; no production operation performed."); process.exitCode = 1; });
