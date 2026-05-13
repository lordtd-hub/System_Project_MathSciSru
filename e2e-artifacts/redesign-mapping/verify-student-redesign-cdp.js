const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const baseUrl = process.env.QA_PREVIEW_URL || "https://system-project-math-sci-o9wb68q02-lordtd-hubs-projects.vercel.app";
const cdpUrl = process.env.EDGE_CDP_URL || "http://127.0.0.1:9333";
const screenshotDir = path.join(process.cwd(), "e2e-artifacts", "redesign-mapping", "screenshots");
const viewportMode = process.env.STUDENT_VERIFY_VIEWPORT === "mobile" ? "mobile" : "desktop";
const studentKey = process.env.STUDENT_VERIFY_KEY || "multi-r2-student-01";
const viewport =
  viewportMode === "mobile"
    ? { width: 390, height: 900, deviceScaleFactor: 2, mobile: true }
    : { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false };
const deploymentSlug =
  new URL(baseUrl).hostname
    .replace(/^system-project-math-sci-/, "")
    .replace(/-.+$/, "") || "qa";

function readPreviewSecret() {
  if (process.env.QA_LIVE_SECRET) return process.env.QA_LIVE_SECRET;
  const envPath = path.join(process.cwd(), ".env.preview.local");
  const body = fs.readFileSync(envPath, "utf8");
  const match = body.match(/^QA_LOGIN_SECRET=(?:"([^"]+)"|'([^']+)'|(.+))$/m);
  if (!match) throw new Error("QA_LOGIN_SECRET not found in .env.preview.local");
  return (match[1] || match[2] || match[3] || "").trim();
}

const secret = readPreviewSecret();
const qaHost = new URL(baseUrl).host;

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
  await send("Emulation.setDeviceMetricsOverride", viewport);
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
  await sleep(1600);
  await evaluate(client, "document.readyState", `goto ${url}`).catch(() => {});
  await sleep(600);
}

async function bodyText(client, label) {
  const text = await evaluate(client, "document.body ? document.body.innerText : ''", label);
  if (!text || text.trim().length < 120) throw new Error(`${label}: shell-only or blank body`);
  if (/Application error|NEXT_REDIRECT|digest/i.test(text)) throw new Error(`${label}: error/digest page`);
  return text;
}

async function clearExistingQaSession(client) {
  const cleared = await evaluate(
    client,
    `
      (() => {
        const forms = Array.from(document.forms);
        const clearForm = forms.find((form) => !form.querySelector("#role") && /QA session|ออกจาก QA session|ออกจากระบบ/.test(form.innerText || ""));
        if (!clearForm) return false;
        clearForm.requestSubmit();
        return true;
      })()
    `,
    "clear existing QA session"
  );
  if (cleared) {
    await sleep(1800);
    await goto(client, `${baseUrl}/qa-login`);
  }
}

async function qaLoginStudent(client) {
  await goto(client, `${baseUrl}/qa-login`);
  await clearExistingQaSession(client);
  await evaluate(
    client,
    `
    (() => {
      const roleSelect = document.querySelector("#role");
      if (!roleSelect) throw new Error("Missing #role");
      const form = roleSelect.closest("form");
      if (!form) throw new Error("Missing QA login form");
      const setSelect = (selector, value) => {
        const el = form.querySelector(selector);
        if (!el) throw new Error("Missing " + selector);
        const normalizedValue = String(value).toLowerCase();
        const option = Array.from(el.options).find((item) => {
          const optionValue = String(item.value || "").toLowerCase();
          const optionText = String(item.textContent || "").toLowerCase();
          return optionValue === normalizedValue || optionText.includes(normalizedValue);
        });
        if (!option) throw new Error("Missing option " + value + " for " + selector);
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
        if (valueSetter) valueSetter.call(el, option.value);
        else el.value = option.value;
        Array.from(el.options).forEach((item) => {
          item.selected = item === option;
        });
        el.selectedIndex = option.index;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      setSelect("#role", "student");
      setSelect("#student_email", ${literal(studentKey)});
      const secret = form.querySelector("#secret");
      if (!secret) throw new Error("Missing #secret");
      secret.value = ${literal(secret)};
      secret.dispatchEvent(new Event("input", { bubbles: true }));
      if (!form.checkValidity()) {
        const invalid = Array.from(form.elements)
          .filter((element) => element.willValidate && !element.checkValidity())
          .map((element) => element.id || element.name || element.tagName);
        throw new Error("QA login form invalid before submit: " + invalid.join(","));
      }
      const data = new FormData(form);
      if (data.get("role") !== "student") throw new Error("QA login role was not set to student before submit");
      if (!String(data.get("student_email") || "").toLowerCase().includes("student")) throw new Error("QA login student identity was not set before submit");
      if (!String(data.get("secret") || "")) throw new Error("QA login secret missing before submit");
      const submitter = form.querySelector('button[type="submit"]');
      if (!submitter) throw new Error("Missing QA login submit button");
      if (submitter?.disabled) throw new Error("QA login submit button is disabled");
      form.requestSubmit(submitter);
      return true;
    })()
  `,
    `qa login student ${studentKey}`
  );
  await sleep(2200);
  const text = await bodyText(client, `after qa login student ${studentKey}`);
  const url = await evaluate(client, "location.href", `after qa login student ${studentKey} url`);
  if (url.includes("/qa-login")) {
    throw new Error(`Expected student dashboard after QA login; still on QA login: ${text.slice(0, 240).replace(/\s+/g, " ")}`);
  }
  if (!new URL(url).pathname.startsWith("/student")) {
    throw new Error(`Expected student dashboard after QA login; got ${url}; body=${text.slice(0, 240).replace(/\s+/g, " ")}`);
  }
}

async function screenshot(client, name) {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const shot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  const filePath = path.join(screenshotDir, name);
  fs.writeFileSync(filePath, Buffer.from(shot.data, "base64"));
  return filePath;
}

async function verifyStudentPage(client, route, name, requirements) {
  await goto(client, `${baseUrl}${route}`);
  const text = await bodyText(client, name);
  const url = await evaluate(client, "location.href", `${route} current url`);
  if (url.includes("/qa-login")) throw new Error(`${route}: redirected to QA login`);
  if (/สำหรับนักศึกษาเท่านั้น|นักศึกษาเท่านั้น/.test(text) && !text.includes("STUDENT")) throw new Error(`${route}: unauthorized student guard rendered`);
  const check = await evaluate(
    client,
    `
      (() => {
        const root = document.scrollingElement || document.documentElement;
        const body = document.body;
        const width = Math.max(root.scrollWidth, body ? body.scrollWidth : 0);
        const viewportWidth = window.innerWidth;
        return {
          actionQueues: document.querySelectorAll(".action-queue-panel").length,
          readabilitySummaries: document.querySelectorAll('[data-testid="student-readability-summary"]').length,
          workflowGroups: document.querySelectorAll(".workflow-group").length,
          buttons: document.querySelectorAll("button, a.button, .button-primary, .button-secondary").length,
          width,
          viewportWidth,
          overflow: width - viewportWidth
        };
      })()
    `,
    `${route} student surface check`
  );
  if (requirements.actionQueues && check.actionQueues < requirements.actionQueues) {
    throw new Error(`${route}: expected at least ${requirements.actionQueues} action queues, found ${check.actionQueues}`);
  }
  if (requirements.readabilitySummaries && check.readabilitySummaries < requirements.readabilitySummaries) {
    throw new Error(`${route}: expected at least ${requirements.readabilitySummaries} readability summaries, found ${check.readabilitySummaries}`);
  }
  if (viewportMode === "mobile" && check.overflow > 4) {
    throw new Error(`${route}: mobile horizontal overflow ${check.overflow}px (scrollWidth=${check.width}, viewport=${check.viewportWidth})`);
  }
  const filePath = await screenshot(client, `${name}.png`);
  return { route, ok: true, screenshot: filePath, check };
}

async function main() {
  const client = await connectPage();
  const results = [];
  await qaLoginStudent(client);
  for (const [route, name, requirements] of [
    ["/student", `student-dashboard-redesign-${viewportMode}-${deploymentSlug}`, { actionQueues: 1 }],
    ["/student/project", `student-project-redesign-${viewportMode}-${deploymentSlug}`, { readabilitySummaries: 1 }],
    ["/student/proposal", `student-proposal-redesign-${viewportMode}-${deploymentSlug}`, { readabilitySummaries: 1 }],
    ["/student/schedule", `student-schedule-redesign-${viewportMode}-${deploymentSlug}`, { readabilitySummaries: 1 }],
    ["/student/report", `student-report-redesign-${viewportMode}-${deploymentSlug}`, { readabilitySummaries: 1 }],
    ["/student/feedback", `student-feedback-redesign-${viewportMode}-${deploymentSlug}`, { readabilitySummaries: 1 }]
  ]) {
    results.push(await verifyStudentPage(client, route, name, requirements));
  }
  client.ws.close();
  console.log(JSON.stringify({ baseUrl, viewportMode, studentKey, viewport, results }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
