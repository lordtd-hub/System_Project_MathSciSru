const http = require("node:http");

const baseUrl = process.env.QA_PREVIEW_URL || "https://system-project-math-sci-cp2k496sw-lordtd-hubs-projects.vercel.app";
const secret = process.env.QA_LIVE_SECRET;
const cdpUrl = process.env.EDGE_CDP_URL || "http://127.0.0.1:9333";
const qaHost = new URL(baseUrl).host;

if (!secret) {
  console.error("QA_LIVE_SECRET is required");
  process.exit(2);
}

const pad2 = (value) => String(value).padStart(2, "0");
const teacherKey = (n) => `multi-r2-teacher-${pad2(n)}`;
const studentKey = (n) => `multi-r2-student-${pad2(n)}`;

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
      if (${literal(roleValue)} === "teacher") setSelect("#teacher_email", ${literal(key)});
      if (${literal(roleValue)} === "student") setSelect("#student_email", ${literal(key)});
      const secret = document.querySelector("#secret");
      if (!secret) throw new Error("Missing #secret");
      secret.value = ${literal(secret)};
      secret.dispatchEvent(new Event("input", { bubbles: true }));
      if (!form.checkValidity()) {
        const invalid = Array.from(form.elements).filter((element) => element.willValidate && !element.checkValidity()).map((element) => element.id || element.name || element.tagName);
        throw new Error("QA login form invalid before submit: " + invalid.join(","));
      }
      form.requestSubmit();
      return true;
    })()
  `, `qa login ${role} ${key}`);
  await sleep(1800);
  const text = await bodyText(client, `after qa login ${role} ${key}`);
  const expected = roleValue === "teacher" ? "TEACHER" : "STUDENT";
  if (!text.includes(expected)) throw new Error(`qa login ${role} ${key}: expected role ${expected} not visible`);
}

async function requestRevisionForW212(client) {
  for (let teacherNo = 1; teacherNo <= 11; teacherNo++) {
    await qaLogin(client, "teacher", teacherKey(teacherNo));
    await goto(client, `${baseUrl}/teacher/reports`);
    const text = await bodyText(client, `teacher ${teacherNo} reports before W2-12 revision`);
    const result = await evaluate(client, `
      (() => {
        const forms = Array.from(document.querySelectorAll("form")).filter((form) => {
          const reportVersionId = form.querySelector('[name="report_version_id"]')?.value;
          if (!reportVersionId) return false;
          const section = form.closest("section") || form.parentElement;
          const text = section?.innerText || "";
          return text.includes("MULTI-PILOT-R2 Wave 2 Project 12");
        });
        const form = forms[0];
        if (!form) return { status: "none" };
        const comment = form.querySelector('[name="comment"]');
        if (!comment) throw new Error("Report review comment field missing");
        comment.value = "Wave 2 latest-version test: please revise the final report and submit version 2 with a change summary.";
        comment.dispatchEvent(new Event("input", { bubbles: true }));
        comment.dispatchEvent(new Event("change", { bubbles: true }));
        const button = form.querySelector('button[name="decision"][value="FAIL"]:not([disabled])');
        if (!button) throw new Error("Report FAIL button not enabled");
        if (!form.checkValidity()) throw new Error("Report FAIL form invalid before submit");
        form.requestSubmit(button);
        return { status: "submitted" };
      })()
    `, `teacher ${teacherNo} request W2-12 report revision`);
    if (result.status === "submitted") {
      await sleep(1800);
      return { teacherNo, result, inspected: text.slice(0, 1600) };
    }
  }
  return { teacherNo: null, result: { status: "not-found" } };
}

async function resubmitW212Report(client) {
  await qaLogin(client, "student", studentKey(12));
  await goto(client, `${baseUrl}/student/report`);
  const before = await bodyText(client, "student 12 report before v2");
  if (!before.includes("ขอให้แก้ไข") && !before.includes("แก้ไขเล่ม")) {
    throw new Error("Student12 revision request is not visible before v2 submit");
  }
  const result = await evaluate(client, `
    (() => {
      const form = Array.from(document.querySelectorAll("form")).find((candidate) => candidate.querySelector('[name="report_drive_link"]'));
      if (!form) return { status: "not-visible" };
      const link = form.querySelector('[name="report_drive_link"]');
      link.value = "https://docs.google.com/document/d/wave2-final-report-12-v2";
      link.dispatchEvent(new Event("input", { bubbles: true }));
      link.dispatchEvent(new Event("change", { bubbles: true }));
      const note = form.querySelector('[name="report_note"]');
      if (note) {
        note.value = "Wave 2 report v2 resubmitted after revision request. Changes: clarified final methods, added result evidence, and responded to reviewer comments.";
        note.dispatchEvent(new Event("input", { bubbles: true }));
        note.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const button = form.querySelector('button[type="submit"]:not([disabled])');
      if (!button) throw new Error("Report v2 submit button not enabled");
      if (!form.checkValidity()) {
        const invalid = Array.from(form.elements).filter((element) => element.willValidate && !element.checkValidity()).map((element) => element.name || element.id || element.tagName);
        throw new Error("Report v2 form invalid: " + invalid.join(","));
      }
      form.requestSubmit(button);
      return { status: "submitted" };
    })()
  `, "student 12 submit report v2");
  if (result.status === "submitted") await sleep(1800);
  await goto(client, `${baseUrl}/student/report`);
  const after = await bodyText(client, "student 12 report after v2");
  if (!after.includes("ฉบับที่ 2")) throw new Error("Student12 report version 2 not visible after resubmit");
  if (!after.includes("ฉบับที่ 1")) throw new Error("Student12 report version 1 history not visible after v2");
  return { result, before: before.slice(0, 1200), after: after.slice(0, 1600) };
}

async function approveVisibleWave2Reports(client, teacherNo) {
  await qaLogin(client, "teacher", teacherKey(teacherNo));
  let approved = 0;
  let inspected = "";
  for (let attempt = 0; attempt < 40; attempt++) {
    await goto(client, `${baseUrl}/teacher/reports`);
    const text = await bodyText(client, `teacher ${teacherNo} reports`);
    inspected = text.slice(0, 1800);
    const result = await evaluate(client, `
      (() => {
        const forms = Array.from(document.querySelectorAll("form")).filter((form) => {
          const reportVersionId = form.querySelector('[name="report_version_id"]')?.value;
          if (!reportVersionId) return false;
          const section = form.closest("section") || form.parentElement;
          const text = section?.innerText || "";
          return text.includes("MULTI-PILOT-R2 Wave 2 Project");
        });
        const form = forms[0];
        if (!form) return { status: "none", remaining: 0 };
        const comment = form.querySelector('[name="comment"]');
        if (!comment) throw new Error("Report review comment field missing");
        comment.value = "Wave 2 report review passed for the latest submitted version after checking report evidence and revision summary.";
        comment.dispatchEvent(new Event("input", { bubbles: true }));
        comment.dispatchEvent(new Event("change", { bubbles: true }));
        const button = form.querySelector('button[name="decision"][value="PASS"]:not([disabled])');
        if (!button) throw new Error("Report PASS button not enabled");
        if (!form.checkValidity()) {
          const invalid = Array.from(form.elements).filter((element) => element.willValidate && !element.checkValidity()).map((element) => element.name || element.id || element.tagName);
          throw new Error("Report PASS form invalid: " + invalid.join(","));
        }
        const section = form.closest("section") || form.parentElement;
        const cardText = (section?.innerText || "").slice(0, 500);
        form.requestSubmit(button);
        return { status: "submitted", remaining: forms.length, cardText };
      })()
    `, `teacher ${teacherNo} approve wave2 report`);
    if (result.status !== "submitted") break;
    approved += 1;
    await sleep(1800);
  }
  return { teacherNo, approved, inspected };
}

async function main() {
  const client = await connectPage();
  const result = { baseUrl, revision: null, resubmit: null, teachers: [] };
  try {
    result.revision = await requestRevisionForW212(client);
    if (result.revision.result.status !== "submitted") {
      throw new Error("W2-12 revision request was not submitted: " + JSON.stringify(result.revision));
    }
    result.resubmit = await resubmitW212Report(client);
    for (let teacherNo = 1; teacherNo <= 11; teacherNo++) {
      result.teachers.push(await approveVisibleWave2Reports(client, teacherNo));
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    client.ws.close();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
