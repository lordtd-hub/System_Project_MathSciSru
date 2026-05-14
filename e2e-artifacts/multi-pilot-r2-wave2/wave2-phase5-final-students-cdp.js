const http = require("node:http");

const baseUrl = process.env.QA_PREVIEW_URL || "https://system-project-math-sci-cp2k496sw-lordtd-hubs-projects.vercel.app";
const secret = process.env.QA_LIVE_SECRET;
const cdpUrl = process.env.EDGE_CDP_URL || "http://127.0.0.1:9333";
const qaHost = new URL(baseUrl).host;
const expectedOfferingTitle = process.env.WAVE2_EXPECTED_OFFERING_TITLE || "MULTI-PILOT-R2 Wave 2 Course Offering";

if (!secret) {
  console.error("QA_LIVE_SECRET is required");
  process.exit(2);
}

const pad2 = (value) => String(value).padStart(2, "0");
const studentKey = (n) => `multi-r2-student-${pad2(n)}`;
const projectTitle = (n) => `MULTI-PILOT-R2 Wave 2 Project ${pad2(n)}`;
const finalProjects = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

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
      if (${literal(roleValue)} === "admin") setSelect("#admin_email", "multi-r2-admin");
      if (${literal(roleValue)} === "student") setSelect("#student_email", ${literal(key)});
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
  if (text.includes("Please select an item in the list")) throw new Error(`qa login ${role} ${key || ""}: browser validation blocked submit`);
  const expected = roleValue === "admin" ? "ADMIN" : "STUDENT";
  if (!text.includes(expected)) throw new Error(`qa login ${role} ${key || ""}: expected role ${expected} not visible`);
}

async function openFinalRound(client) {
  await qaLogin(client, "admin");
  await goto(client, `${baseUrl}/admin/rounds`);
  const beforeText = await bodyText(client, "admin rounds before final open");
  if (!beforeText.includes(expectedOfferingTitle)) {
    throw new Error("Admin rounds is not on Wave 2 offering");
  }
  const result = await evaluate(client, `
    (() => {
      const forms = Array.from(document.querySelectorAll("form"));
      const candidates = forms.filter((candidate) => candidate.querySelector('[name="round_type"]')?.value === "FINAL_PRESENTATION");
      const enabled = candidates.find((candidate) => candidate.querySelector('button[type="submit"]:not([disabled])'));
      if (!enabled) return { status: "already-open-or-not-actionable", forms: candidates.length };
      const button = enabled.querySelector('button[type="submit"]:not([disabled])');
      enabled.requestSubmit(button);
      return { status: "submitted-open", buttonText: button.innerText || "" };
    })()
  `, "open final round");
  if (result.status === "submitted-open") await sleep(1800);
  await goto(client, `${baseUrl}/admin/rounds`);
  const afterText = await bodyText(client, "admin rounds after final open");
  if (!afterText.includes(expectedOfferingTitle)) throw new Error("Wave 2 offering missing after final open");
  return result;
}

async function submitStudentFinal(client, projectNo) {
  await qaLogin(client, "student", studentKey(projectNo));
  await goto(client, `${baseUrl}/student/schedule`);
  const before = await bodyText(client, `student ${projectNo} schedule before final`);
  if (!before.includes("STUDENT")) throw new Error(`student ${projectNo}: student role not visible`);
  if (!before.includes(projectTitle(projectNo))) throw new Error(`student ${projectNo}: Wave 2 project title not visible`);

  const evidenceResult = await evaluate(client, `
    (() => {
      const form = document.querySelector('[data-testid="student-assessment-evidence-form-FINAL_PRESENT"]');
      if (!form) return "already-saved-or-not-visible";
      const set = (name, value) => {
        const el = form.querySelector('[name="' + name + '"]');
        if (!el) throw new Error("Missing final evidence field " + name);
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      set("submission_title", "Wave 2 Final evidence ${pad2(projectNo)}");
      set("material_link", "https://drive.google.com/file/d/wave2-final-${pad2(projectNo)}/view");
      set("final_objectives_evidence", "Final objectives are completed for ${projectTitle(projectNo)} with evidence mapped to proposal objectives and deliverables.");
      set("final_methods_results", "Final methods, proof or implementation results, and analysis are ready for committee review.");
      set("final_timeline_adaptation", "Timeline execution and adaptations are documented, including resolved risks and final adjustments.");
      set("final_report_readiness", "Report draft, figures, tables, references, and likely committee questions are prepared for final presentation.");
      const button = form.querySelector('button[type="submit"]:not([disabled])');
      if (!button) throw new Error("Final evidence submit button not enabled");
      if (!form.checkValidity()) {
        const invalid = Array.from(form.elements).filter((element) => element.willValidate && !element.checkValidity()).map((element) => element.name || element.id || element.tagName);
        throw new Error("Final evidence form invalid: " + invalid.join(","));
      }
      form.requestSubmit(button);
      return "submitted";
    })()
  `, `student ${projectNo} submit final evidence`);
  if (evidenceResult === "submitted") await sleep(1800);

  await goto(client, `${baseUrl}/student/schedule`);
  const afterEvidenceText = await bodyText(client, `student ${projectNo} after final evidence`);
  if (!afterEvidenceText.includes("Wave 2 Final evidence") && !afterEvidenceText.includes("FINAL")) {
    throw new Error(`student ${projectNo}: final evidence state not visible after submit`);
  }

  const scheduleDate = `2026-07-${pad2(1 + projectNo)}`;
  const scheduleResult = await evaluate(client, `
    (() => {
      const forms = Array.from(document.querySelectorAll("form")).filter((candidate) => candidate.querySelector('[name="round_type"]'));
      const form = forms.find((candidate) => {
        const select = candidate.querySelector('[name="round_type"]');
        const option = Array.from(select?.options || []).find((item) => item.value === "FINAL_PRESENTATION");
        return option && !option.disabled;
      });
      if (!form) return "already-scheduled-or-not-visible";
      const set = (name, value) => {
        const el = form.querySelector('[name="' + name + '"]');
        if (!el) throw new Error("Missing schedule field " + name);
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      set("round_type", "FINAL_PRESENTATION");
      set("schedule_date", ${literal(scheduleDate)});
      set("room", "W2-FINAL-${pad2(projectNo)}");
      set("start_time", "13:00");
      set("end_time", "14:00");
      const note = form.querySelector('[name="schedule_note"]');
      if (note) {
        note.value = "Wave 2 Final schedule proposal for ${projectTitle(projectNo)}.";
        note.dispatchEvent(new Event("input", { bubbles: true }));
        note.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const button = form.querySelector('button[type="submit"]:not([disabled])');
      if (!button) throw new Error("Final schedule submit button not enabled");
      if (!form.checkValidity()) {
        const invalid = Array.from(form.elements).filter((element) => element.willValidate && !element.checkValidity()).map((element) => element.name || element.id || element.tagName);
        throw new Error("Final schedule form invalid: " + invalid.join(","));
      }
      form.requestSubmit(button);
      return "submitted";
    })()
  `, `student ${projectNo} submit final schedule`);
  if (scheduleResult === "submitted") await sleep(1800);

  await goto(client, `${baseUrl}/student/schedule`);
  const afterScheduleText = await bodyText(client, `student ${projectNo} after final schedule`);
  if (!afterScheduleText.includes("W2-FINAL")) {
    throw new Error(`student ${projectNo}: final schedule state not visible after submit`);
  }
  return { projectNo, evidenceResult, scheduleResult };
}

async function main() {
  const client = await connectPage();
  const result = { baseUrl, openFinal: null, students: [] };
  try {
    result.openFinal = await openFinalRound(client);
    for (const projectNo of finalProjects) {
      result.students.push(await submitStudentFinal(client, projectNo));
    }
    await qaLogin(client, "admin");
    await goto(client, `${baseUrl}/admin/rounds`);
    result.adminRoundExcerpt = (await bodyText(client, "admin rounds after final student submissions")).slice(0, 2500);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    client.ws.close();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});


