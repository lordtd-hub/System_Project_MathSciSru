const http = require("node:http");

const baseUrl = process.env.QA_PREVIEW_URL || "https://system-project-math-sci-daaspquy0-lordtd-hubs-projects.vercel.app";
const secret = process.env.QA_LIVE_SECRET;
const cdpUrl = process.env.EDGE_CDP_URL || "http://127.0.0.1:9333";
const qaHost = new URL(baseUrl).host;

if (!secret) {
  console.error("QA_LIVE_SECRET is required");
  process.exit(2);
}

const pad2 = (value) => String(value).padStart(2, "0");
const studentKey = (n) => `multi-r2-student-${pad2(n)}`;
const projectTitle = (n) => `MULTI-PILOT-R2 Wave 2 Project ${pad2(n)}`;
const normalProgress2Projects = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

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
  const targets = await getJson(`${cdpUrl}/json/list`);
  const target = targets.find((item) => item.type === "page" && item.url.includes(qaHost)) || targets.find((item) => item.type === "page");
  if (!target) throw new Error("No Edge page target found");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  let id = 0;
  const callbacks = new Map();
  const listeners = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && callbacks.has(message.id)) {
      const { resolve, reject } = callbacks.get(message.id);
      callbacks.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
    if (message.method && listeners.has(message.method)) {
      for (const handler of listeners.get(message.method)) handler(message.params || {});
    }
  });

  function send(method, params = {}) {
    const messageId = ++id;
    ws.send(JSON.stringify({ id: messageId, method, params }));
    return new Promise((resolve, reject) => callbacks.set(messageId, { resolve, reject }));
  }

  function on(method, handler) {
    if (!listeners.has(method)) listeners.set(method, new Set());
    listeners.get(method).add(handler);
  }

  on("Page.javascriptDialogOpening", () => {
    send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
  });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.setLifecycleEventsEnabled", { enabled: true }).catch(() => {});

  return { send, ws };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function literal(value) {
  return JSON.stringify(value);
}

async function evaluate(client, expression, label) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  });
  if (result.exceptionDetails) {
    const text = result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime exception";
    throw new Error(`${label}: ${text}`);
  }
  return result.result?.value;
}

async function goto(client, url) {
  await client.send("Page.navigate", { url });
  await sleep(1200);
  await evaluate(client, "document.readyState", `goto ${url}`).catch(() => {});
  await sleep(500);
}

async function bodyText(client, label) {
  const text = await evaluate(client, "document.body ? document.body.innerText : ''", label);
  if (!text || text.trim().length < 120) throw new Error(`${label}: shell-only or blank body`);
  if (/Application error|NEXT_REDIRECT|digest/i.test(text)) throw new Error(`${label}: error/digest page`);
  return text;
}

async function qaLogin(client, role, key) {
  const roleValue = String(role).toLowerCase();
  await goto(client, `${baseUrl}/qa-login`);
  const submitted = await evaluate(client, `
    (() => {
      const form = document.querySelector("form:has(#secret)");
      if (!form) throw new Error("Missing QA login form");
      const setSelect = (selector, value) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error("Missing " + selector);
        const option = Array.from(el.options).find((item) => item.value === value || item.textContent.includes(value));
        if (!option) throw new Error("Missing option " + value + " for " + selector);
        el.value = option.value;
        option.selected = true;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      setSelect("#role", ${literal(roleValue)});
      if (${literal(roleValue)} === "admin") setSelect("#admin_email", "multi-r2-admin");
      if (${literal(roleValue)} === "student") setSelect("#student_email", ${literal(key)});
      if (${literal(roleValue)} === "teacher") setSelect("#teacher_email", ${literal(key)});
      const secret = document.querySelector("#secret");
      if (!secret) throw new Error("Missing #secret");
      secret.value = ${literal(secret)};
      secret.dispatchEvent(new Event("input", { bubbles: true }));
      if (document.querySelector("#role").value !== ${literal(roleValue)}) throw new Error("Role value mismatch before submit");
      if (!form.checkValidity()) {
        const invalid = Array.from(form.elements).filter((element) => element.willValidate && !element.checkValidity()).map((element) => element.id || element.name || element.tagName);
        throw new Error("QA login form invalid before submit: " + invalid.join(","));
      }
      form.requestSubmit();
      return { role: document.querySelector("#role").value };
    })()
  `, `qa login ${role} ${key || ""}`);
  await sleep(1800);
  const text = await bodyText(client, `after qa login ${role} ${key || ""}`);
  if (text.includes("Please select an item in the list")) {
    throw new Error(`qa login ${role} ${key || ""}: browser validation blocked submit after selected role ${JSON.stringify(submitted)}`);
  }
  const expected = roleValue === "admin" ? "ADMIN" : roleValue === "student" ? "STUDENT" : "TEACHER";
  if (!text.includes(expected)) throw new Error(`qa login ${role} ${key || ""}: expected role ${expected} not visible`);
}

async function openProgress2Round(client) {
  await qaLogin(client, "admin");
  await goto(client, `${baseUrl}/admin/rounds`);
  const beforeText = await bodyText(client, "admin rounds before progress2 open");
  if (!beforeText.includes("MULTI-PILOT-R2 Wave 2 Course Offering")) {
    throw new Error("Admin rounds is not on Wave 2 offering");
  }
  const result = await evaluate(client, `
    (() => {
      const forms = Array.from(document.querySelectorAll("form"));
      const form = forms.find((candidate) => {
        const roundType = candidate.querySelector('[name="round_type"]');
        const button = candidate.querySelector('button[type="submit"]:not([disabled])');
        return roundType?.value === "PROGRESS_2" && button && (button.innerText || "").includes("เปิดรอบ");
      });
      const disabledProgress2Open = forms.find((candidate) => candidate.querySelector('[name="round_type"]')?.value === "PROGRESS_2");
      if (!form && disabledProgress2Open?.querySelector('button[type="submit"]')?.disabled) return "already-open-or-disabled";
      if (!form) throw new Error("No enabled Progress 2 open-round form found");
      const button = form.querySelector('button[type="submit"]:not([disabled])');
      form.requestSubmit(button);
      return "submitted-open";
    })()
  `, "open progress2 round");
  if (result === "submitted-open") await sleep(1800);
  await goto(client, `${baseUrl}/admin/rounds`);
  const afterText = await bodyText(client, "admin rounds after progress2 open");
  if (!afterText.includes("การสอบความก้าวหน้าครั้งที่ 2")) throw new Error("Progress 2 text missing after open");
  if (!afterText.includes("เปิดอยู่")) throw new Error("Progress 2 did not show open state after open action");
  return result;
}

async function submitStudentProgress2(client, projectNo) {
  await qaLogin(client, "student", studentKey(projectNo));
  await goto(client, `${baseUrl}/student/schedule`);
  const before = await bodyText(client, `student ${projectNo} schedule before progress2`);
  if (!before.includes("STUDENT")) throw new Error(`student ${projectNo}: student role not visible`);
  if (!before.includes("สอบความก้าวหน้าครั้งที่ 2")) throw new Error(`student ${projectNo}: Progress 2 schedule page not visible`);

  const evidenceResult = await evaluate(client, `
    (() => {
      const form = document.querySelector('[data-testid="student-assessment-evidence-form-PROGRESS_2"]');
      if (!form) return "already-saved-or-not-visible";
      const set = (name, value) => {
        const el = form.querySelector('[name="' + name + '"]');
        if (!el) throw new Error("Missing evidence field " + name);
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      set("submission_title", "Wave 2 Progress 2 evidence ${pad2(projectNo)}");
      set("material_link", "https://drive.google.com/file/d/wave2-progress2-${pad2(projectNo)}/view");
      set("progress_plan_tasks", "Weeks 1-8 tasks completed for ${projectTitle(projectNo)}. Core modelling, proof notes, and implementation log are ready for review.");
      set("progress_evidence", "Evidence package includes draft proof, computation notebook, result table, and presentation slides for Progress 2.");
      set("progress_status", "Completed planned Progress 2 milestones; remaining work is tracked for the next round.");
      set("progress_challenges_next", "Main challenge is refining validation and preparing Progress 2 deliverables.");
      const button = form.querySelector('button[type="submit"]:not([disabled])');
      if (!button) throw new Error("Evidence submit button not enabled");
      if (!form.checkValidity()) {
        const invalid = Array.from(form.elements).filter((element) => element.willValidate && !element.checkValidity()).map((element) => element.name || element.id || element.tagName);
        throw new Error("Evidence form invalid: " + invalid.join(","));
      }
      form.requestSubmit(button);
      return "submitted";
    })()
  `, `student ${projectNo} submit progress2 evidence`);
  if (evidenceResult === "submitted") await sleep(1800);

  await goto(client, `${baseUrl}/student/schedule`);
  const afterEvidenceText = await bodyText(client, `student ${projectNo} after progress2 evidence`);
  if (!afterEvidenceText.includes("Wave 2 Progress 2 evidence") && !afterEvidenceText.includes("บันทึกเอกสาร")) {
    throw new Error(`student ${projectNo}: progress2 evidence state not visible after submit`);
  }

  const scheduleDate = `2026-06-${pad2(1 + projectNo)}`;
  const scheduleResult = await evaluate(client, `
    (() => {
      const form = Array.from(document.querySelectorAll("form")).find((candidate) => candidate.querySelector('[name="round_type"]'));
      if (!form) return "already-scheduled-or-not-visible";
      const set = (name, value) => {
        const el = form.querySelector('[name="' + name + '"]');
        if (!el) throw new Error("Missing schedule field " + name);
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      set("round_type", "PROGRESS_2");
      set("schedule_date", ${literal(scheduleDate)});
      set("room", "W2-P2-${pad2(projectNo)}");
      set("start_time", "09:00");
      set("end_time", "10:00");
      const note = form.querySelector('[name="schedule_note"]');
      if (note) {
        note.value = "Wave 2 Progress 2 schedule proposal for ${projectTitle(projectNo)}.";
        note.dispatchEvent(new Event("input", { bubbles: true }));
        note.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const button = form.querySelector('button[type="submit"]:not([disabled])');
      if (!button) throw new Error("Schedule submit button not enabled");
      if (!form.checkValidity()) {
        const invalid = Array.from(form.elements).filter((element) => element.willValidate && !element.checkValidity()).map((element) => element.name || element.id || element.tagName);
        throw new Error("Schedule form invalid: " + invalid.join(","));
      }
      form.requestSubmit(button);
      return "submitted";
    })()
  `, `student ${projectNo} submit progress2 schedule`);
  if (scheduleResult === "submitted") await sleep(1800);

  await goto(client, `${baseUrl}/student/schedule`);
  const afterScheduleText = await bodyText(client, `student ${projectNo} after progress2 schedule`);
  if (!afterScheduleText.includes("W2-P2") && !afterScheduleText.includes("ส่งขอนัด")) {
    throw new Error(`student ${projectNo}: progress2 schedule state not visible after submit`);
  }
  return { projectNo, evidenceResult, scheduleResult };
}

async function main() {
  const client = await connectPage();
  const result = { baseUrl, openProgress2: null, students: [] };
  try {
    result.openProgress2 = await openProgress2Round(client);
    for (const projectNo of normalProgress2Projects) {
      result.students.push(await submitStudentProgress2(client, projectNo));
    }
    await qaLogin(client, "admin");
    await goto(client, `${baseUrl}/admin/rounds`);
    const adminText = await bodyText(client, "admin rounds after progress2 student submissions");
    result.adminRoundExcerpt = adminText.slice(0, 2500);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    client.ws.close();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
