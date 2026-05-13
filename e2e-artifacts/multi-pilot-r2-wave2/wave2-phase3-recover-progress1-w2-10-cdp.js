const http = require("node:http");

const baseUrl = process.env.QA_PREVIEW_URL || "https://system-project-math-sci-gddt5b4jw-lordtd-hubs-projects.vercel.app";
const secret = process.env.QA_LIVE_SECRET;
const cdpUrl = process.env.EDGE_CDP_URL || "http://127.0.0.1:9333";
const qaHost = new URL(baseUrl).host;

if (!secret) {
  console.error("QA_LIVE_SECRET is required");
  process.exit(2);
}

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
  await evaluate(client, `
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
      if (${literal(roleValue)} === "student") setSelect("#student_email", ${literal(key)});
      if (${literal(roleValue)} === "teacher") setSelect("#teacher_email", ${literal(key)});
      if (${literal(roleValue)} === "admin") setSelect("#admin_email", "multi-r2-admin");
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
      return true;
    })()
  `, `qa login ${role} ${key || ""}`);
  await sleep(1800);
  const text = await bodyText(client, `after qa login ${role} ${key || ""}`);
  const expected = roleValue === "admin" ? "ADMIN" : roleValue === "student" ? "STUDENT" : "TEACHER";
  if (!text.includes(expected)) throw new Error(`qa login ${role} ${key || ""}: expected role ${expected} not visible`);
}

async function recoverStudent10(client) {
  await qaLogin(client, "student", "multi-r2-student-10");
  await goto(client, `${baseUrl}/student/schedule`);
  const before = await bodyText(client, "student10 schedule before recovery submit");
  if (!before.includes("STUDENT")) throw new Error("Student10 role guard failed");
  const hasProgress1EvidenceForm = await evaluate(
    client,
    `Boolean(document.querySelector('[data-testid="student-assessment-evidence-form-PROGRESS_1"]'))`,
    "student10 progress1 evidence form presence"
  );
  if (!hasProgress1EvidenceForm && !before.includes("Wave 2 Progress 1 late recovery evidence 10")) {
    throw new Error(`Student10 Progress 1 late recovery form is not visible. Excerpt: ${before.slice(0, 5000)}`);
  }
  const evidenceResult = await evaluate(client, `
    (() => {
      const form = document.querySelector('[data-testid="student-assessment-evidence-form-PROGRESS_1"]');
      if (!form) return "not-visible-or-already-saved";
      const set = (name, value) => {
        const el = form.querySelector('[name="' + name + '"]');
        if (!el) throw new Error("Missing evidence field " + name);
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      set("submission_title", "Wave 2 Progress 1 late recovery evidence 10");
      set("material_link", "https://drive.google.com/file/d/wave2-progress1-10-late/view");
      set("progress_plan_tasks", "Late recovery Progress 1 work for Wave 2 Project 10 is complete.");
      set("progress_evidence", "Late recovery evidence includes proof notes, slides, and current result summary.");
      set("progress_status", "Completed after late exception was opened by Admin.");
      set("progress_challenges_next", "Proceed to Progress 2 after committee scoring is completed.");
      const button = form.querySelector('button[type="submit"]:not([disabled])');
      if (!button) throw new Error("Evidence submit button not enabled");
      if (!form.checkValidity()) throw new Error("Evidence form invalid");
      form.requestSubmit(button);
      return "submitted";
    })()
  `, "student10 submit late progress1 evidence");
  if (evidenceResult === "submitted") await sleep(1800);

  await goto(client, `${baseUrl}/student/schedule`);
  const scheduleResult = await evaluate(client, `
    (() => {
      const form = Array.from(document.querySelectorAll("form")).find((candidate) => candidate.querySelector('[name="round_type"]'));
      if (!form) return "not-visible-or-already-scheduled";
      const set = (name, value) => {
        const el = form.querySelector('[name="' + name + '"]');
        if (!el) throw new Error("Missing schedule field " + name);
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      set("round_type", "PROGRESS_1");
      set("schedule_date", "2026-06-15");
      set("room", "W2-P1-10");
      set("start_time", "09:00");
      set("end_time", "10:00");
      const note = form.querySelector('[name="schedule_note"]');
      if (note) {
        note.value = "Wave 2 Progress 1 late recovery schedule for W2-10.";
        note.dispatchEvent(new Event("input", { bubbles: true }));
        note.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const button = form.querySelector('button[type="submit"]:not([disabled])');
      if (!button) throw new Error("Schedule submit button not enabled");
      if (!form.checkValidity()) throw new Error("Schedule form invalid");
      form.requestSubmit(button);
      return "submitted";
    })()
  `, "student10 submit late progress1 schedule");
  if (scheduleResult === "submitted") await sleep(1800);
  await goto(client, `${baseUrl}/student/schedule`);
  const after = await bodyText(client, "student10 schedule after recovery submit");
  if (!after.includes("W2-P1-10")) throw new Error("Student10 late schedule not visible after submit");
  return { evidenceResult, scheduleResult, afterExcerpt: after.slice(0, 1800) };
}

async function main() {
  const client = await connectPage();
  try {
    const result = { baseUrl, student10: await recoverStudent10(client) };
    console.log(JSON.stringify(result, null, 2));
  } finally {
    client.ws.close();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
