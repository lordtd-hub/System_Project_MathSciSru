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
      if (${literal(roleValue)} === "admin") setSelect("#admin_email", "multi-r2-admin");
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
  `, `qa login ${role} ${key || ""}`);
  await sleep(1800);
  const text = await bodyText(client, `after qa login ${role} ${key || ""}`);
  const expected = roleValue === "admin" ? "ADMIN" : "TEACHER";
  if (!text.includes(expected)) throw new Error(`qa login ${role} ${key || ""}: expected role ${expected} not visible`);
}

async function scoreVisibleWave2Progress1(client, teacherNo) {
  await qaLogin(client, "teacher", teacherKey(teacherNo));
  let submitted = 0;
  let inspected = "";
  for (let attempt = 0; attempt < 20; attempt++) {
    await goto(client, `${baseUrl}/teacher/progress1`);
    const text = await bodyText(client, `teacher ${teacherNo} progress1`);
    if (!text.includes("TEACHER")) throw new Error(`teacher ${teacherNo}: teacher role not visible`);
    inspected = text.slice(0, 1600);
    const result = await evaluate(client, `
      (() => {
        const forms = Array.from(document.querySelectorAll("form")).filter((form) => {
          const projectId = form.querySelector('[name="project_id"]')?.value;
          if (!projectId) return false;
          const section = form.closest("section") || form.parentElement;
          const text = section?.innerText || "";
          return text.includes("MULTI-PILOT-R2 Wave 2 Project") && text.includes("Progress 1");
        });
        const form = forms[0];
        if (!form) return { status: "none", remaining: 0 };
        for (const select of form.querySelectorAll('select[name^="condition_count:"]')) {
          const options = Array.from(select.options);
          const maxValue = options.map((option) => Number(option.value)).filter(Number.isFinite).sort((a, b) => b - a)[0] ?? 3;
          select.value = String(maxValue);
          select.dispatchEvent(new Event("input", { bubbles: true }));
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        for (const input of form.querySelectorAll('input[type="number"]')) {
          input.value = input.max || "10";
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const comment = form.querySelector('[name="comment"]');
        if (comment) {
          comment.value = "Wave 2 Progress 1 score submitted after confirmed schedule and evidence review.";
          comment.dispatchEvent(new Event("input", { bubbles: true }));
          comment.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const button = form.querySelector('button[type="submit"]:not([disabled])');
        if (!button) throw new Error("Progress 1 score button not enabled");
        if (!form.checkValidity()) {
          const invalid = Array.from(form.elements).filter((element) => element.willValidate && !element.checkValidity()).map((element) => element.name || element.id || element.tagName);
          throw new Error("Progress 1 score form invalid: " + invalid.join(","));
        }
        const section = form.closest("section") || form.parentElement;
        const cardText = (section?.innerText || "").slice(0, 500);
        form.requestSubmit(button);
        return { status: "submitted", remaining: forms.length, cardText };
      })()
    `, `teacher ${teacherNo} submit progress1 score`);
    if (result.status !== "submitted") break;
    submitted += 1;
    await sleep(1800);
  }
  return { teacherNo, submitted, inspected };
}

async function main() {
  const client = await connectPage();
  const result = { baseUrl, teachers: [], adminRoundExcerpt: "" };
  try {
    for (let teacherNo = 1; teacherNo <= 11; teacherNo++) {
      result.teachers.push(await scoreVisibleWave2Progress1(client, teacherNo));
    }
    await qaLogin(client, "admin");
    await goto(client, `${baseUrl}/admin/rounds`);
    result.adminRoundExcerpt = (await bodyText(client, "admin rounds after progress1 scoring")).slice(0, 2600);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    client.ws.close();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
