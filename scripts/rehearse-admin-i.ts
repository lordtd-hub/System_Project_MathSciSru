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
  const pg17 = true;
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

    stage = "single-ACTIVE migration precondition and rollback";
    const migrationFile = join(app, "prisma/migrations/20261114120000_single_active_course_offering/migration.sql");
    const migrationSql = await readFile(migrationFile, "utf8");
    sql("term_rollover_inherited", "CREATE TABLE public.course_offerings(id text PRIMARY KEY,status text NOT NULL); INSERT INTO public.course_offerings VALUES ('a','ACTIVE'),('b','ACTIVE');");
    await rejects(async () => sql("term_rollover_inherited", migrationSql), "existing two ACTIVE rows must abort migration");
    check(sql("term_rollover_inherited", "SELECT count(*) FROM course_offerings WHERE status='ACTIVE'").trim() === "2", "no automatic close or deletion in failed migration");
    check(sql("term_rollover_inherited", "SELECT count(*) FROM pg_indexes WHERE indexname='course_offerings_single_active'").trim() === "0", "failed migration leaves no partial index");
    pass("migration aborts atomically for existing multiple ACTIVE, no data changes/no auto-close");
    stage = "full migrations on own PostgreSQL17";
    sql("term_rollover_main", "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;");
    prismaCommand(["migrate", "deploy"], "term_rollover_main");
    Object.assign(process.env, envFor("term_rollover_main"));
    const { prisma } = await import("../src/lib/db"); client = prisma;
    check(await prisma.$queryRaw<Array<{n:bigint}>>`SELECT count(*) AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`.then(r=>Number(r[0].n)) === 10, "exact ten migrations");
    for (const table of ["project_academic_results", "incomplete_continuations"]) {
      check(sql("term_rollover_main", "SELECT relrowsecurity FROM pg_class WHERE oid='public."+table+"'::regclass").trim() === "t", "RLS remains enabled");
      check(sql("term_rollover_main", "SELECT count(*) FROM information_schema.table_privileges WHERE table_schema='public' AND table_name='"+table+"' AND grantee IN ('anon','authenticated','PUBLIC')").trim() === "0", "no inherited browser CRUD/MAINTAIN grants");
    }
    sql("term_rollover_main", "DROP INDEX public.course_offerings_single_active");
    sql("term_rollover_main", migrationSql);
    pass("all ten migrations apply on PostgreSQL17 with broad synthetic default grants; existing RLS/revocations remain; index-only rollback/reapply changes no rows");
    stage = "actual services, concurrency, replay and preservation";
    const { runAdminICases } = await import("./rehearse-admin-i-cases");
    const baseScenario = await runAdminICases(prisma, pass);
    const { runAdminIChecklistCases } = await import("./rehearse-admin-i-checklist-cases");
    const scenario = { ...baseScenario, ...await runAdminIChecklistCases(prisma, baseScenario, pass) };
    await writeFile(join(workspace,"admin-i-checklist-postgres17-verification.json"), JSON.stringify({ utc:new Date().toISOString(),runId,serverVersion,passed,syntheticOnly:true,productionConnections:0,emailsSent:0,migrationSHA256:createHash("sha256").update(migrationSql).digest("hex"),uiCompleted:false },null,2));
    if(withUi) {
      stage="local UI server";
      web=spawn(process.execPath,[join(app,"node_modules/next/dist/bin/next"),"dev","--hostname","127.0.0.1","--port",String(uiPort)],{cwd:app,env:{...envFor("term_rollover_main"),NODE_ENV:"development"},stdio:["ignore","pipe","pipe"],windowsHide:true});
      web.stdout?.on("data",chunk=>{webLog+=clean(String(chunk));});web.stderr?.on("data",chunk=>{webLog+=clean(String(chunk));});
      let ready=false;for(let attempt=0;attempt<60;attempt++){if(web.exitCode!==null)throw Error("Local UI exited");try{if((await fetch(`http://127.0.0.1:${uiPort}/dev-login`)).ok){ready=true;break;}}catch{ /* Only wait for this owned local server. */ }await pause(500);}
      check(ready,"local UI ready");const stop=join(root,"ui-complete");
      await writeFile(join(workspace,"admin-i-checklist-local-ui-session.json"),JSON.stringify({runId,url:`http://127.0.0.1:${uiPort}`,stopFile:stop,scenario,syntheticOnly:true},null,2));
      console.log("UI_READY: admin-i-checklist-local-ui-session.json; separate localhost synthetic server only");
      for(let attempt=0;attempt<7200;attempt++){if(existsSync(stop))break;if(attempt===7199)throw Error("UI window expired");await pause(500);}
    }
  } catch (error) {
    const value=error as {message?:string;code?:string;stderr?:Buffer};
    console.error(`FAIL at ${stage}: ${clean(String(value.code??value.message??"unknown"))}`);
    await writeFile(join(workspace,"admin-i-checklist-postgres17-error.json"),JSON.stringify({utc:new Date().toISOString(),stage,passed,error:clean(String(value.message??value.code??"unknown")),syntheticOnly:true,productionConnections:0},null,2));
    if(value.stderr)await writeFile(join(workspace,"admin-i-checklist-postgres17-error.log"),clean(value.stderr.toString("utf8")));
    process.exitCode=1;
  } finally {
    if (web && web.exitCode === null && web.pid) { try { execFileSync("taskkill.exe", ["/PID", String(web.pid), "/T", "/F"], { stdio: "pipe", windowsHide: true }); } catch { process.exitCode = 1; } }
    await client?.$disconnect().catch(() => undefined);
    let safelyStopped = !started;
    if (started) { try { execFileSync(join(pg, "pg_ctl.exe"), ["-D", data, "-m", "fast", "-w", "-t", "30", "stop"], { stdio: "pipe", windowsHide: true }); safelyStopped = true; } catch { process.exitCode = 1; console.error("Test database stop requires attention; retaining directory."); } }
    const actualRoot = await realpath(root), actualWorkspace = await realpath(workspace);
    check(actualRoot.toLowerCase().startsWith(`${actualWorkspace}${sep}`.toLowerCase()) && basename(actualRoot).startsWith("term-rehearsal-") && await readFile(marker, "utf8") === runId, "bounded synthetic cleanup");
    if (existsSync(pgLog)) await writeFile(join(workspace, "admin-i-checklist-postgres-server.log"), clean(await readFile(pgLog, "utf8")));
    await writeFile(join(workspace, "admin-i-checklist-local-web.log"), clean(webLog));
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
