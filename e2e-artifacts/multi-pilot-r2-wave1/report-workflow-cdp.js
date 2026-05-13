const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const CDP = process.env.CDP_URL || "http://127.0.0.1:9333";
const QA_HOST = process.env.QA_HOST || "system-project-math-sci-cdw7n9wk6-lordtd-hubs-projects.vercel.app";
const QA_SECRET = process.env.QA_SECRET;
const screenshotDir = path.join("e2e-artifacts", "multi-pilot-r2-wave1", "screenshots");
const progressPath = path.join("e2e-artifacts", "multi-pilot-r2-wave1", "report-workflow-progress.json");

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

async function connectPage() {
  const targets = await getJson(`${CDP}/json/list`);
  let pageTarget = targets.find((target) => target.type === "page" && target.url.includes(QA_HOST));
  if (!pageTarget) pageTarget = targets.find((target) => target.type === "page");
  if (!pageTarget) throw new Error("No Edge CDP page target found");

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  let id = 0;
  const callbacks = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Page.javascriptDialogOpening") {
      ws.send(JSON.stringify({ id: ++id, method: "Page.handleJavaScriptDialog", params: { accept: true } }));
      return;
    }
    if (message.id && callbacks.has(message.id)) {
      const { resolve, reject } = callbacks.get(message.id);
      callbacks.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  });

  function send(method, params = {}) {
    const messageId = ++id;
    ws.send(JSON.stringify({ id: messageId, method, params }));
    return new Promise((resolve, reject) => callbacks.set(messageId, { resolve, reject }));
  }

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.setLifecycleEventsEnabled", { enabled: true });
  send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
  send("Page.enable").catch(() => {});
  return { ws, send };
}

async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  }
  return result.result.value;
}

async function waitFor(send, predicateSource, label, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ok = await evaluate(send, predicateSource);
    if (ok) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const state = await evaluate(send, `(() => ({ url: location.href, text: document.body.innerText.slice(0, 1200) }))()`);
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(state)}`);
}

async function screenshot(send, name) {
  const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  fs.mkdirSync(screenshotDir, { recursive: true });
  const out = path.join(screenshotDir, name);
  fs.writeFileSync(out, Buffer.from(result.data, "base64"));
  return out;
}

async function navigate(send, route) {
  await send("Page.navigate", { url: `https://${QA_HOST}${route}` });
  await waitFor(send, `(() => document.readyState === "complete" || document.readyState === "interactive")()`, `navigate ${route}`);
}

async function login(send, role, identity) {
  if (!QA_SECRET) throw new Error("QA_SECRET env var is required for QA role switching");
  await navigate(send, "/qa-login");
  const result = await evaluate(
    send,
    `(() => {
      const form = Array.from(document.forms).find((item) => item.querySelector('select[name="role"]'));
      if (!form) return { ok: false, reason: "login form not found" };
      const role = form.querySelector('select[name="role"]');
      const secret = form.querySelector('input[name="secret"]');
      role.value = ${JSON.stringify(role)};
      role.dispatchEvent(new Event("change", { bubbles: true }));
      const selectName = ${JSON.stringify(role === "admin" ? "admin_email" : role === "teacher" ? "teacher_email" : "student_email")};
      const identitySelect = form.querySelector('select[name="' + selectName + '"]');
      if (!identitySelect) return { ok: false, reason: "identity select not found" };
      identitySelect.value = ${JSON.stringify(identity)};
      identitySelect.dispatchEvent(new Event("change", { bubbles: true }));
      secret.value = ${JSON.stringify(QA_SECRET)};
      secret.dispatchEvent(new Event("input", { bubbles: true }));
      form.requestSubmit();
      return { ok: true };
    })()`
  );
  if (!result.ok) throw new Error(`QA login failed before submit: ${result.reason}`);
  const targetPath = role === "admin" ? "/admin" : role === "teacher" ? "/teacher" : "/student";
  await waitFor(send, `(() => location.pathname.startsWith(${JSON.stringify(targetPath)}))()`, `login ${role} ${identity}`, 20000);
}

async function submitStudentReport(send, studentIdentity, studentCode, versionLabel) {
  await login(send, "student", studentIdentity);
  await navigate(send, "/student/report");
  const studentEmailFragment = studentIdentity.replace("multi-r2-", "multi.pilot.r2.").replace(/-(\d+)$/, "$1");
  const guard = await evaluate(
    send,
    `(() => {
      const text = document.body.innerText;
      return {
        url: location.href,
        hasIdentity: text.includes(${JSON.stringify(studentCode)}) || text.includes(${JSON.stringify(studentEmailFragment)}),
        hasForm: Boolean(document.querySelector('input[name="report_drive_link"]')),
        hasHistory: text.includes("ฉบับที่ 1") || text.includes("ฉบับที่ 2"),
        text: text.slice(0, 1200)
      };
    })()`
  );
  if (!guard.hasIdentity) throw new Error(`Student guard failed for ${studentCode}`);
  if (!guard.hasForm) return { skipped: true, reason: "no active report form", guard };

  await evaluate(
    send,
    `(() => {
      const form = document.querySelector('input[name="report_drive_link"]')?.closest("form");
      if (!form) return false;
      const link = form.querySelector('input[name="report_drive_link"]');
      const note = form.querySelector('textarea[name="report_note"]');
      link.value = "https://docs.google.com/document/d/${studentCode.toLowerCase()}-${versionLabel}/edit";
      link.dispatchEvent(new Event("input", { bubbles: true }));
      if (note) {
        note.value = "ส่งรายงาน ${versionLabel} สำหรับ Wave 1 report workflow verification";
        note.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const button = Array.from(form.querySelectorAll('button')).find((item) => item.type === "submit");
      if (!button) return false;
      button.click();
      return true;
    })()`
  );
  await waitFor(
    send,
    `(() => location.pathname === "/student/report" && !document.body.innerText.includes("กำลังส่ง") && (location.search.includes("success=report_submitted") || document.body.innerText.includes("ฉบับที่")))()`,
    `report submit ${studentCode}`,
    30000
  );
  const shot = await screenshot(send, `report-${studentCode}-${versionLabel}-submitted.png`);
  const state = await evaluate(send, `(() => ({ url: location.href, text: document.body.innerText.slice(0, 1600), hasForm: Boolean(document.querySelector('input[name="report_drive_link"]')) }))()`);
  return { skipped: false, screenshot: shot, state };
}

async function reviewReport(send, teacherIdentity, studentCode, decision, commentSlug) {
  await login(send, "teacher", teacherIdentity);
  await navigate(send, "/teacher/reports");
  const guard = await evaluate(
    send,
    `(() => {
      const section = Array.from(document.querySelectorAll("section.panel")).find((item) => item.innerText.includes(${JSON.stringify(studentCode)}));
      if (!section) return { ok: false, reason: "project section not found", text: document.body.innerText.slice(0, 1400) };
      const form = section.querySelector('input[name="report_version_id"]')?.closest("form");
      return {
        ok: true,
        hasForm: Boolean(form),
        sectionText: section.innerText.slice(0, 1600),
        reportVersionId: form?.querySelector('input[name="report_version_id"]')?.value ?? null
      };
    })()`
  );
  if (!guard.ok) throw new Error(`Teacher report guard failed for ${teacherIdentity}/${studentCode}: ${guard.reason}\n${guard.text}`);
  if (!guard.hasForm) return { skipped: true, reason: "no active review form", guard };

  await evaluate(
    send,
    `(() => {
      const section = Array.from(document.querySelectorAll("section.panel")).find((item) => item.innerText.includes(${JSON.stringify(studentCode)}));
      const form = section.querySelector('input[name="report_version_id"]')?.closest("form");
      const textarea = form.querySelector('textarea[name="comment"]');
      if (textarea) {
        textarea.value = ${JSON.stringify(commentSlug)};
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const submitter = Array.from(form.querySelectorAll('button[name="decision"]')).find((button) => button.value === ${JSON.stringify(decision)});
      if (!submitter) return false;
      form.requestSubmit(submitter);
      return true;
    })()`
  );
  await waitFor(
    send,
    `(() => location.pathname === "/teacher/reports" && (location.search.includes("success=report_review_saved") || location.search.includes("success=report_revision_requested") || document.body.innerText.includes("บันทึกผลตรวจของท่านแล้ว") || document.body.innerText.includes("รายงานผ่านแล้ว")))()`,
    `review ${teacherIdentity} ${studentCode} ${decision}`,
    30000
  );
  const shot = await screenshot(send, `report-review-${studentCode}-${teacherIdentity}-${decision}.png`);
  const state = await evaluate(send, `(() => ({ url: location.href, text: document.body.innerText.slice(0, 1800) }))()`);
  return { skipped: false, screenshot: shot, state };
}

async function submitAdvisorScore(send, teacherIdentity, studentCode) {
  await login(send, "teacher", teacherIdentity);
  await navigate(send, "/teacher/advisor-score");
  const guard = await evaluate(
    send,
    `(() => {
      const section = Array.from(document.querySelectorAll("section.panel")).find((item) => item.innerText.includes(${JSON.stringify(studentCode)}));
      if (!section) return { ok: false, reason: "advisor score section not found", text: document.body.innerText.slice(0, 1600) };
      const form = section.querySelector('input[name="project_id"]')?.closest("form");
      return { ok: true, hasForm: Boolean(form), sectionText: section.innerText.slice(0, 1600) };
    })()`
  );
  if (!guard.ok) throw new Error(`Advisor score guard failed for ${teacherIdentity}/${studentCode}: ${guard.reason}\n${guard.text}`);
  if (!guard.hasForm) return { skipped: true, reason: "no active advisor score form", guard };

  await evaluate(
    send,
    `(() => {
      const section = Array.from(document.querySelectorAll("section.panel")).find((item) => item.innerText.includes(${JSON.stringify(studentCode)}));
      const form = section.querySelector('input[name="project_id"]')?.closest("form");
      const values = { responsibility: 23, research_process: 23, problem_solving: 23, communication: 14, professionalism: 9 };
      for (const [name, value] of Object.entries(values)) {
        const input = form.querySelector('input[name="' + name + '"]');
        if (input) {
          input.value = String(value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      const comment = form.querySelector('textarea[name="comment"]');
      if (comment) {
        comment.value = "บันทึกคะแนนที่ปรึกษาหลังรายงานผ่าน สำหรับ Wave 1";
        comment.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const button = Array.from(form.querySelectorAll("button")).find((item) => item.type === "submit");
      if (!button) return false;
      button.click();
      return true;
    })()`
  );
  await waitFor(
    send,
    `(() => location.pathname === "/teacher/advisor-score" && (location.search.includes("success=advisor_score_saved") || document.body.innerText.includes("บันทึกแล้ว")))()`,
    `advisor score ${teacherIdentity} ${studentCode}`,
    30000
  );
  const shot = await screenshot(send, `advisor-score-${studentCode}-${teacherIdentity}.png`);
  const state = await evaluate(send, `(() => ({ url: location.href, text: document.body.innerText.slice(0, 1800) }))()`);
  return { skipped: false, screenshot: shot, state };
}

async function verifyStudent03Locked(send) {
  await login(send, "student", "multi-r2-student-03");
  await navigate(send, "/student/report");
  const state = await evaluate(send, `(() => ({ url: location.href, hasIdentity: document.body.innerText.includes("multi.pilot.r2.student03"), hasForm: Boolean(document.querySelector('input[name="report_drive_link"]')), text: document.body.innerText.slice(0, 1400) }))()`);
  const shot = await screenshot(send, "report-student03-locked.png");
  if (!state.hasIdentity) throw new Error("Student03 identity guard failed");
  if (state.hasForm) throw new Error("Student03 unexpectedly has report submission form");
  return { screenshot: shot, state };
}

async function closeout(send, studentCode) {
  await login(send, "admin", "multi-r2-admin");
  await navigate(send, "/admin/closeout");
  const guard = await evaluate(
    send,
    `(() => {
      const card = Array.from(document.querySelectorAll("article.panel")).find((item) => item.innerText.includes(${JSON.stringify(studentCode)}));
      if (!card) return { ok: false, reason: "closeout card not found", text: document.body.innerText.slice(0, 1600) };
      const form = card.querySelector('input[name="project_id"]')?.closest("form");
      return { ok: true, hasForm: Boolean(form), cardText: card.innerText.slice(0, 1600) };
    })()`
  );
  if (!guard.ok) throw new Error(`Closeout guard failed for ${studentCode}: ${guard.reason}\n${guard.text}`);
  if (!guard.hasForm) return { skipped: true, reason: "no active closeout form", guard };
  await evaluate(
    send,
    `(() => {
      const card = Array.from(document.querySelectorAll("article.panel")).find((item) => item.innerText.includes(${JSON.stringify(studentCode)}));
      const form = card.querySelector('input[name="project_id"]')?.closest("form");
      const button = Array.from(form.querySelectorAll("button")).find((item) => item.type === "submit");
      if (!button) return false;
      button.click();
      return true;
    })()`
  );
  await waitFor(
    send,
    `(() => location.pathname === "/admin/closeout" && (location.search.includes("success=project_completed") || document.body.innerText.includes("โครงงานเสร็จสมบูรณ์แล้ว")))()`,
    `closeout ${studentCode}`,
    30000
  );
  const shot = await screenshot(send, `admin-closeout-${studentCode}.png`);
  const state = await evaluate(send, `(() => ({ url: location.href, text: document.body.innerText.slice(0, 1800) }))()`);
  return { skipped: false, screenshot: shot, state };
}

async function evidenceCheck(send) {
  await login(send, "admin", "multi-r2-admin");
  await navigate(send, "/admin/evidence");
  const state = await evaluate(
    send,
    `(async () => {
      const links = Array.from(document.querySelectorAll('a[href*="/admin/evidence/exports/"]')).map((a) => ({ text: a.textContent.trim(), href: a.href }));
      const results = [];
      for (const link of links.filter((item) => item.text === "CSV" || item.text === "Excel").slice(0, 12)) {
        const res = await fetch(link.href, { credentials: "include" });
        results.push({ href: link.href, status: res.status, contentType: res.headers.get("content-type"), bytes: (await res.arrayBuffer()).byteLength });
      }
      return { url: location.href, hasGradeExport: document.body.innerText.includes("สรุปคะแนนรายบุคคล"), links: links.length, results, text: document.body.innerText.slice(0, 1800) };
    })()`
  );
  const shot = await screenshot(send, "admin-evidence-export-check.png");
  const failed = state.results.filter((item) => item.status !== 200 || item.bytes === 0);
  if (failed.length) throw new Error(`Evidence export check failed: ${JSON.stringify(failed)}`);
  return { screenshot: shot, state };
}

async function studentCompletedGuard(send, studentIdentity, studentCode) {
  await login(send, "student", studentIdentity);
  await navigate(send, "/student");
  const state = await evaluate(send, `(() => ({ url: location.href, text: document.body.innerText.slice(0, 1600) }))()`);
  const shot = await screenshot(send, `student-${studentCode}-completed-dashboard.png`);
  return { screenshot: shot, state };
}

async function run() {
  const { ws, send } = await connectPage();
  try {
    await send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: path.resolve("test-results") }).catch(() => {});
    const command = process.argv[2] || "state";
    const output = [];
    async function step(name, fn) {
      console.log(`STEP ${name}`);
      const result = await fn();
      output.push({ step: name, result });
      fs.writeFileSync(progressPath, JSON.stringify(output, null, 2));
      return result;
    }
    if (command === "navigate") {
      await navigate(send, process.argv[3] || "/qa-login");
      output.push(await evaluate(send, `(() => ({ url: location.href, text: document.body.innerText.slice(0, 1200) }))()`));
    } else if (command === "report-phase") {
      await step("submit-student01", () => submitStudentReport(send, "multi-r2-student-01", "R2STU01", "v1"));
      await step("submit-student04", () => submitStudentReport(send, "multi-r2-student-04", "R2STU04", "v1"));
      await step("submit-student05-v1", () => submitStudentReport(send, "multi-r2-student-05", "R2STU05", "v1"));
      await step("student03-locked", () => verifyStudent03Locked(send));
      await step("p1-review-t01", () => reviewReport(send, "multi-r2-teacher-01", "R2STU01", "PASS", "อนุมัติรายงาน Project01 โดยที่ปรึกษา"));
      await step("p1-review-t02", () => reviewReport(send, "multi-r2-teacher-02", "R2STU01", "PASS", "อนุมัติรายงาน Project01 โดยประธาน/กรรมการ"));
      await step("p1-review-t03", () => reviewReport(send, "multi-r2-teacher-03", "R2STU01", "PASS", "อนุมัติรายงาน Project01 โดยกรรมการ"));
      await step("p4-review-t01", () => reviewReport(send, "multi-r2-teacher-01", "R2STU04", "PASS", "อนุมัติรายงาน Project04 โดยกรรมการ"));
      await step("p4-review-t02", () => reviewReport(send, "multi-r2-teacher-02", "R2STU04", "PASS", "อนุมัติรายงาน Project04 โดยกรรมการ"));
      await step("p4-review-t03", () => reviewReport(send, "multi-r2-teacher-03", "R2STU04", "PASS", "อนุมัติรายงาน Project04 โดยที่ปรึกษา"));
      await step("p5-v1-pass-t02", () => reviewReport(send, "multi-r2-teacher-02", "R2STU05", "PASS", "อนุมัติรายงาน Project05 ฉบับที่ 1 เพื่อทดสอบว่า PASS เก่าไม่ข้ามไปฉบับใหม่"));
      await step("p5-v1-reject-t01", () => reviewReport(send, "multi-r2-teacher-01", "R2STU05", "FAIL", "ขอให้แก้ไขรายงาน Project05 ฉบับที่ 1: เพิ่มรายละเอียดผลลัพธ์และหลักฐานประกอบ"));
      await step("submit-student05-v2", () => submitStudentReport(send, "multi-r2-student-05", "R2STU05", "v2"));
      await step("p5-v2-review-t02", () => reviewReport(send, "multi-r2-teacher-02", "R2STU05", "PASS", "อนุมัติรายงาน Project05 ฉบับที่ 2 หลังแก้ไข"));
      await step("p5-v2-review-t01", () => reviewReport(send, "multi-r2-teacher-01", "R2STU05", "PASS", "อนุมัติรายงาน Project05 ฉบับที่ 2 โดยกรรมการ"));
      await step("p5-v2-review-t03", () => reviewReport(send, "multi-r2-teacher-03", "R2STU05", "PASS", "อนุมัติรายงาน Project05 ฉบับที่ 2 โดยที่ปรึกษา"));
      await step("advisor-p1-t01", () => submitAdvisorScore(send, "multi-r2-teacher-01", "R2STU01"));
      await step("advisor-p4-t03", () => submitAdvisorScore(send, "multi-r2-teacher-03", "R2STU04"));
      await step("advisor-p5-t03", () => submitAdvisorScore(send, "multi-r2-teacher-03", "R2STU05"));
      await step("closeout-p1", () => closeout(send, "R2STU01"));
      await step("closeout-p4", () => closeout(send, "R2STU04"));
      await step("closeout-p5", () => closeout(send, "R2STU05"));
      await step("student01-completed", () => studentCompletedGuard(send, "multi-r2-student-01", "R2STU01"));
      await step("student04-completed", () => studentCompletedGuard(send, "multi-r2-student-04", "R2STU04"));
      await step("student05-completed", () => studentCompletedGuard(send, "multi-r2-student-05", "R2STU05"));
      await step("evidence", () => evidenceCheck(send));
    } else if (command === "evidence") {
      await step("evidence", () => evidenceCheck(send));
    } else if (command === "state") {
      output.push(await evaluate(send, `(() => ({ url: location.href, text: document.body.innerText.slice(0, 2000) }))()`));
    } else {
      throw new Error(`Unknown command ${command}`);
    }
    console.log(JSON.stringify(output, null, 2));
  } finally {
    ws.close();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
