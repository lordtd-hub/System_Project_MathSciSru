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

async function qaLoginTeacher(client, key) {
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
      setSelect("#role", "teacher");
      setSelect("#teacher_email", ${literal(key)});
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
  `, `qa login teacher ${key}`);
  await sleep(1800);
  const text = await bodyText(client, `after qa login teacher ${key}`);
  if (!text.includes("TEACHER")) throw new Error(`teacher ${key}: TEACHER role not visible`);
}

async function submitAdvisorScores(client, teacherNo) {
  await qaLoginTeacher(client, teacherKey(teacherNo));
  let submitted = 0;
  let inspected = "";
  for (let attempt = 0; attempt < 30; attempt++) {
    await goto(client, `${baseUrl}/teacher/advisor-score`);
    const text = await bodyText(client, `teacher ${teacherNo} advisor-score`);
    inspected = text.slice(0, 1800);
    const result = await evaluate(client, `
      (() => {
        const forms = Array.from(document.querySelectorAll("form")).filter((form) => {
          const projectId = form.querySelector('[name="project_id"]')?.value;
          if (!projectId) return false;
          const section = form.closest("section") || form.parentElement;
          const text = section?.innerText || "";
          return text.includes("MULTI-PILOT-R2 Wave 2 Project");
        });
        const form = forms[0];
        if (!form) return { status: "none", remaining: 0 };
        const values = {
          responsibility: "25",
          research_process: "25",
          problem_solving: "25",
          communication: "15",
          professionalism: "10"
        };
        for (const [name, value] of Object.entries(values)) {
          const input = form.querySelector('[name="' + name + '"]');
          if (!input) throw new Error("Missing advisor score field " + name);
          input.value = value;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const comment = form.querySelector('[name="comment"]');
        if (comment) {
          comment.value = "Wave 2 advisor score submitted after latest report approval.";
          comment.dispatchEvent(new Event("input", { bubbles: true }));
          comment.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const button = form.querySelector('button[type="submit"]:not([disabled])');
        if (!button) throw new Error("Advisor score submit button not enabled");
        if (!form.checkValidity()) {
          const invalid = Array.from(form.elements).filter((element) => element.willValidate && !element.checkValidity()).map((element) => element.name || element.id || element.tagName);
          throw new Error("Advisor score form invalid: " + invalid.join(","));
        }
        const section = form.closest("section") || form.parentElement;
        const cardText = (section?.innerText || "").slice(0, 500);
        form.requestSubmit(button);
        return { status: "submitted", remaining: forms.length, cardText };
      })()
    `, `teacher ${teacherNo} submit advisor score`);
    if (result.status !== "submitted") break;
    submitted += 1;
    await sleep(1800);
  }
  return { teacherNo, submitted, inspected };
}

async function main() {
  const client = await connectPage();
  const result = { baseUrl, teachers: [] };
  try {
    for (let teacherNo = 1; teacherNo <= 11; teacherNo++) {
      result.teachers.push(await submitAdvisorScores(client, teacherNo));
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
