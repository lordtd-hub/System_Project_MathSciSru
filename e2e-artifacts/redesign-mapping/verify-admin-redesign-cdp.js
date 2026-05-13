const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const baseUrl = process.env.QA_PREVIEW_URL || "https://system-project-math-sci-1thdur8ic-lordtd-hubs-projects.vercel.app";
const cdpUrl = process.env.EDGE_CDP_URL || "http://127.0.0.1:9333";
const screenshotDir = path.join(process.cwd(), "e2e-artifacts", "redesign-mapping", "screenshots");
const viewportMode = process.env.ADMIN_VERIFY_VIEWPORT === "mobile" ? "mobile" : "desktop";
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

async function qaLoginAdmin(client) {
  await goto(client, `${baseUrl}/qa-login`);
  const clearedExistingSession = await evaluate(
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
  if (clearedExistingSession) {
    await sleep(1800);
    await goto(client, `${baseUrl}/qa-login`);
  }
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
      setSelect("#role", "admin");
      setSelect("#admin_email", "admin");
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
      if (data.get("role") !== "admin") throw new Error("QA login role was not set to admin before submit");
      if (!String(data.get("admin_email") || "").toLowerCase().includes("admin")) throw new Error("QA login admin identity was not set before submit");
      if (!String(data.get("secret") || "")) throw new Error("QA login secret missing before submit");
      const submitter = form.querySelector('button[type="submit"]');
      if (!submitter) throw new Error("Missing QA login submit button");
      if (submitter?.disabled) throw new Error("QA login submit button is disabled");
      form.requestSubmit(submitter);
      return true;
    })()
  `,
    "qa login admin"
  );
  await sleep(2200);
  const text = await bodyText(client, "after qa login admin");
  const url = await evaluate(client, "location.href", "after qa login admin url");
  if (url.includes("/qa-login")) {
    const loginState = await evaluate(
      client,
      `
        (() => {
          const role = document.querySelector("#role");
          const admin = document.querySelector("#admin_email");
          const secret = document.querySelector("#secret");
          const button = role?.closest("form")?.querySelector('button[type="submit"]');
          const feedback = document.querySelector('[role="alert"], .alert, .panel')?.innerText || "";
          return {
            role: role?.value || null,
            admin: admin?.value || null,
            secretLength: secret?.value?.length || 0,
            buttonDisabled: Boolean(button?.disabled),
            buttonText: button?.innerText || null,
            feedback: feedback.slice(0, 240)
          };
        })()
      `,
      "qa login debug state"
    );
    throw new Error(`Expected admin dashboard after QA login; still on QA login; state=${JSON.stringify(loginState)}; body=${text.slice(0, 240).replace(/\s+/g, " ")}`);
  }
  if (!new URL(url).pathname.startsWith("/admin")) {
    throw new Error(`Expected admin dashboard after QA login; got ${url}; body=${text.slice(0, 240).replace(/\s+/g, " ")}`);
  }
  const hasAdminSurface = await evaluate(client, "Boolean(document.querySelector('.dashboard-console-panel, .action-queue-panel'))", "admin surface after login");
  if (!hasAdminSurface) {
    throw new Error(`Expected redesigned admin dashboard surface after login; url=${url}; body=${text.slice(0, 240).replace(/\s+/g, " ")}`);
  }
}

async function screenshot(client, name) {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const shot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  const filePath = path.join(screenshotDir, name);
  fs.writeFileSync(filePath, Buffer.from(shot.data, "base64"));
  return filePath;
}

async function getDevSessionSummary(client) {
  const cookies = await client.send("Network.getCookies", { urls: [baseUrl] }).catch(() => ({ cookies: [] }));
  const devCookie = cookies.cookies?.find((cookie) => cookie.name === "project_assessment_dev_session");
  if (!devCookie?.value) return null;
  const [payload] = devCookie.value.split(".");
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    return { role: parsed.role, roles: parsed.roles, email: parsed.email, name: parsed.name };
  } catch {
    return { role: "unreadable" };
  }
}

async function verifyAdminPage(client, route, name, requirements) {
  await goto(client, `${baseUrl}${route}`);
  const text = await bodyText(client, name);
  const url = await evaluate(client, "location.href", `${route} current url`);
  if (url.includes("/qa-login")) throw new Error(`${route}: redirected to QA login`);
  const devSession = await getDevSessionSummary(client);
  if (/สำหรับผู้ดูแลระบบเท่านั้น|ผู้ดูแลระบบเท่านั้น/.test(text) && devSession?.role !== "ADMIN") {
    throw new Error(`${route}: unauthorized admin guard rendered; devSession=${JSON.stringify(devSession)}`);
  }

  const check = await evaluate(
    client,
    `
      (() => {
        const root = document.scrollingElement || document.documentElement;
        const body = document.body;
        const width = Math.max(root.scrollWidth, body ? body.scrollWidth : 0);
        const viewportWidth = window.innerWidth;
        return {
          dashboardPanels: document.querySelectorAll(".dashboard-console-panel").length,
          actionQueues: document.querySelectorAll(".action-queue-panel").length,
          adminBadges: document.querySelectorAll(".badge-red, .badge-warn, .badge-ok, .badge-lock").length,
          buttons: document.querySelectorAll("button, a.button, .button-primary, .button-secondary").length,
          width,
          viewportWidth,
          overflow: width - viewportWidth
        };
      })()
    `,
    `${route} admin surface check`
  );

  if (requirements.dashboardPanels && check.dashboardPanels < requirements.dashboardPanels) {
    throw new Error(`${route}: expected at least ${requirements.dashboardPanels} dashboard panels, found ${check.dashboardPanels}`);
  }
  if (requirements.actionQueues && check.actionQueues < requirements.actionQueues) {
    throw new Error(`${route}: expected at least ${requirements.actionQueues} action queues, found ${check.actionQueues}`);
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
  await qaLoginAdmin(client);
  for (const [route, name, requirements] of [
    ["/admin", `admin-dashboard-redesign-${viewportMode}-${deploymentSlug}`, { dashboardPanels: 3, actionQueues: 1 }],
    ["/admin/rounds", `admin-rounds-redesign-${viewportMode}-${deploymentSlug}`, { dashboardPanels: 1 }],
    ["/admin/closeout", `admin-closeout-redesign-${viewportMode}-${deploymentSlug}`, { dashboardPanels: 1 }],
    ["/admin/proposals", `admin-proposals-redesign-${viewportMode}-${deploymentSlug}`, { dashboardPanels: 1 }],
    ["/admin/schedules", `admin-schedules-redesign-${viewportMode}-${deploymentSlug}`, { dashboardPanels: 1 }],
    ["/admin/evidence", `admin-evidence-redesign-${viewportMode}-${deploymentSlug}`, { dashboardPanels: 1 }]
  ]) {
    results.push(await verifyAdminPage(client, route, name, requirements));
  }
  client.ws.close();
  console.log(JSON.stringify({ baseUrl, viewportMode, viewport, results }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
