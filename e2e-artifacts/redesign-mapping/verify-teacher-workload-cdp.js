const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const baseUrl = process.env.QA_PREVIEW_URL || "https://system-project-math-sci-lsd4f1th3-lordtd-hubs-projects.vercel.app";
const cdpUrl = process.env.EDGE_CDP_URL || "http://127.0.0.1:9333";
const screenshotDir = path.join(process.cwd(), "e2e-artifacts", "redesign-mapping", "screenshots");
const viewportMode = process.env.TEACHER_VERIFY_VIEWPORT === "mobile" ? "mobile" : "desktop";
const teacherKey = process.env.TEACHER_VERIFY_KEY || "multi-r2-teacher-01";
const viewport = viewportMode === "mobile"
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
  const cleared = await evaluate(client, `
    (() => {
      const forms = Array.from(document.forms);
      const clearForm = forms.find((form) => !form.querySelector("#role") && /QA session|ออกจาก QA session|ออกจากระบบ/.test(form.innerText || ""));
      if (!clearForm) return false;
      clearForm.requestSubmit();
      return true;
    })()
  `, "clear existing QA session");
  if (cleared) {
    await sleep(1800);
    await goto(client, `${baseUrl}/qa-login`);
  }
}

async function qaLoginTeacher(client, teacherKey) {
  await goto(client, `${baseUrl}/qa-login`);
  await clearExistingQaSession(client);
  await evaluate(client, `
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
      setSelect("#role", "teacher");
      setSelect("#teacher_email", ${literal(teacherKey)});
      const secret = document.querySelector("#secret");
      if (!secret) throw new Error("Missing #secret");
      secret.value = ${literal(secret)};
      secret.dispatchEvent(new Event("input", { bubbles: true }));
      if (!form.checkValidity()) {
        const invalid = Array.from(form.elements).filter((element) => element.willValidate && !element.checkValidity()).map((element) => element.id || element.name || element.tagName);
        throw new Error("QA login form invalid before submit: " + invalid.join(","));
      }
      const data = new FormData(form);
      if (data.get("role") !== "teacher") throw new Error("QA login role was not set to teacher before submit");
      if (!String(data.get("teacher_email") || "").toLowerCase().includes("teacher")) throw new Error("QA login teacher identity was not set before submit");
      if (!String(data.get("secret") || "")) throw new Error("QA login secret missing before submit");
      const submitter = form.querySelector('button[type="submit"]');
      if (!submitter) throw new Error("Missing QA login submit button");
      if (submitter?.disabled) throw new Error("QA login submit button is disabled");
      form.requestSubmit(submitter);
      return true;
    })()
  `, `qa login teacher ${teacherKey}`);
  await sleep(2200);
  const text = await bodyText(client, `after qa login teacher ${teacherKey}`);
  const url = await evaluate(client, "location.href", `after qa login teacher ${teacherKey} url`);
  const hasSummary = await evaluate(client, "Boolean(document.querySelector('.teacher-workload-summary'))", `after qa login teacher ${teacherKey} summary`);
  if (url.includes("/qa-login")) {
    throw new Error(`Expected teacher dashboard after QA login for ${teacherKey}; still on QA login: ${text.slice(0, 240).replace(/\s+/g, " ")}`);
  }
  if (/สำหรับอาจารย์ที่อนุมัติแล้วเท่านั้น/.test(text) || !hasSummary) {
    throw new Error(`Expected authorized teacher dashboard after QA login for ${teacherKey}; url=${url}; hasSummary=${hasSummary}; body=${text.slice(0, 240).replace(/\s+/g, " ")}`);
  }
  if (!text.includes("TEACHER") && !text.includes("อาจารย์")) {
    throw new Error(`Expected teacher dashboard after QA login for ${teacherKey}`);
  }
}

async function screenshot(client, name) {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const shot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  const filePath = path.join(screenshotDir, name);
  fs.writeFileSync(filePath, Buffer.from(shot.data, "base64"));
  return filePath;
}

async function verifyTeacherPage(client, route, name) {
  await goto(client, `${baseUrl}${route}`);
  const text = await bodyText(client, name);
  if (/สำหรับอาจารย์ที่อนุมัติแล้วเท่านั้น/.test(text)) throw new Error(`${route}: unauthorized teacher guard rendered`);
  const hasSummaryBeforeTextCheck = await evaluate(client, "Boolean(document.querySelector('.teacher-workload-summary'))", `${route} summary class early`);
  const hasQueueSurfaceBeforeTextCheck = await evaluate(client, "Boolean(document.querySelector('.teacher-workload-metric'))", `${route} metric class early`);
  if (hasSummaryBeforeTextCheck && hasQueueSurfaceBeforeTextCheck) {
    const overflow = await evaluate(client, `
      (() => {
        const root = document.scrollingElement || document.documentElement;
        const body = document.body;
        const width = Math.max(root.scrollWidth, body ? body.scrollWidth : 0);
        const viewportWidth = window.innerWidth;
        return { width, viewportWidth, overflow: width - viewportWidth };
      })()
    `, `${route} overflow check`);
    if (viewportMode === "mobile" && overflow.overflow > 4) {
      throw new Error(`${route}: mobile horizontal overflow ${overflow.overflow}px (scrollWidth=${overflow.width}, viewport=${overflow.viewportWidth})`);
    }
    const filePath = await screenshot(client, `${name}.png`);
    return { route, ok: true, screenshot: filePath, overflow };
  }
  if (!text.includes("สรุปภาระงานอาจารย์")) {
    const url = await evaluate(client, "location.href", `${route} current url`);
    const hasSummary = await evaluate(client, "Boolean(document.querySelector('.teacher-workload-summary'))", `${route} summary class probe`);
    throw new Error(`${route}: missing workload summary; url=${url}; hasSummaryClass=${hasSummary}; body=${text.slice(0, 320).replace(/\\s+/g, " ")}`);
  }
  if (!text.includes("ต้องทำตอนนี้")) throw new Error(`${route}: missing action-first total`);
  const hasSummary = await evaluate(client, "Boolean(document.querySelector('.teacher-workload-summary'))", `${route} summary class`);
  const hasQueueSurface = await evaluate(client, "Boolean(document.querySelector('.teacher-workload-metric'))", `${route} metric class`);
  if (!hasSummary || !hasQueueSurface) throw new Error(`${route}: redesigned teacher workload classes missing`);
  const overflow = await evaluate(client, `
    (() => {
      const root = document.scrollingElement || document.documentElement;
      const body = document.body;
      const width = Math.max(root.scrollWidth, body ? body.scrollWidth : 0);
      const viewportWidth = window.innerWidth;
      return { width, viewportWidth, overflow: width - viewportWidth };
    })()
  `, `${route} overflow check`);
  if (viewportMode === "mobile" && overflow.overflow > 4) {
    throw new Error(`${route}: mobile horizontal overflow ${overflow.overflow}px (scrollWidth=${overflow.width}, viewport=${overflow.viewportWidth})`);
  }
  const filePath = await screenshot(client, `${name}.png`);
  return { route, ok: true, screenshot: filePath, overflow };
}

async function main() {
  const client = await connectPage();
  const results = [];
  await qaLoginTeacher(client, teacherKey);
  for (const [route, name] of [
    ["/teacher", `teacher-dashboard-redesign-${viewportMode}-${deploymentSlug}`],
    ["/teacher/schedules", `teacher-schedules-redesign-${viewportMode}-${deploymentSlug}`],
    ["/teacher/proposals", `teacher-proposals-redesign-${viewportMode}-${deploymentSlug}`],
    ["/teacher/progress1", `teacher-progress1-redesign-${viewportMode}-${deploymentSlug}`],
    ["/teacher/progress2", `teacher-progress2-redesign-${viewportMode}-${deploymentSlug}`],
    ["/teacher/final", `teacher-final-redesign-${viewportMode}-${deploymentSlug}`],
    ["/teacher/reports", `teacher-reports-redesign-${viewportMode}-${deploymentSlug}`],
    ["/teacher/advisor-score", `teacher-advisor-score-redesign-${viewportMode}-${deploymentSlug}`]
  ]) {
    results.push(await verifyTeacherPage(client, route, name));
  }
  client.ws.close();
  console.log(JSON.stringify({ baseUrl, viewportMode, teacherKey, viewport, results }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
