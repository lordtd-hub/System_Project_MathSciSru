const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const baseUrl =
  process.env.QA_PREVIEW_URL ||
  "https://system-project-math-sci-844q8gqj9-lordtd-hubs-projects.vercel.app";
const cdpUrl = process.env.EDGE_CDP_URL || "http://127.0.0.1:9333";
const studentKey = process.env.STUDENT_VERIFY_KEY || "multi-r2-student-01";
const screenshotDir = path.join(process.cwd(), "e2e-artifacts", "redesign-mapping", "screenshots");
const viewportMode = process.env.STUDENT_VERIFY_VIEWPORT === "mobile" ? "mobile" : "desktop";
const viewport =
  viewportMode === "mobile"
    ? { width: 390, height: 900, deviceScaleFactor: 2, mobile: true }
    : { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false };
const deploymentSlug =
  new URL(baseUrl).hostname
    .replace(/^system-project-math-sci-/, "")
    .replace(/-.+$/, "") || "qa";
const qaHost = new URL(baseUrl).host;

function readPreviewSecret() {
  if (process.env.QA_LIVE_SECRET) return process.env.QA_LIVE_SECRET;
  const envPath = path.join(process.cwd(), ".env.preview.local");
  const body = fs.readFileSync(envPath, "utf8");
  const match = body.match(/^QA_LOGIN_SECRET=(?:"([^"]+)"|'([^']+)'|(.+))$/m);
  if (!match) throw new Error("QA_LOGIN_SECRET not found");
  return (match[1] || match[2] || match[3] || "").trim();
}

const secret = readPreviewSecret();

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
  const target =
    targets.find((item) => item.type === "page" && item.url.includes(qaHost)) ||
    targets.find((item) => item.type === "page" && !item.url.includes("figma.com")) ||
    targets.find((item) => item.type === "page");
  if (!target) throw new Error("No Edge page target found");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const callbacks = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !callbacks.has(message.id)) return;
    const { resolve, reject } = callbacks.get(message.id);
    callbacks.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  function send(method, params = {}) {
    const messageId = ++id;
    ws.send(JSON.stringify({ id: messageId, method, params }));
    return new Promise((resolve, reject) => callbacks.set(messageId, { resolve, reject }));
  }
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.bringToFront").catch(() => {});
  await send("Emulation.setDeviceMetricsOverride", viewport);
  return { send, ws };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  await sleep(1800);
  await evaluate(client, "document.readyState", `goto ${url}`).catch(() => {});
  await sleep(700);
}

async function qaLoginStudent(client) {
  await goto(client, `${baseUrl}/qa-login`);
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
          const normalized = String(value).toLowerCase();
          const option = Array.from(el.options).find((item) => {
            const optionValue = String(item.value || "").toLowerCase();
            const optionText = String(item.textContent || "").toLowerCase();
            return optionValue === normalized || optionValue.includes(normalized) || optionText.includes(normalized);
          });
          if (!option) throw new Error("Missing option " + value + " for " + selector);
          el.value = option.value;
          Array.from(el.options).forEach((item) => {
            item.selected = item === option;
          });
          el.selectedIndex = option.index;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        };
        setSelect("#role", "student");
        setSelect("#student_email", ${literal(studentKey)});
        const secretInput = form.querySelector("#secret");
        if (!secretInput) throw new Error("Missing #secret");
        secretInput.value = ${literal(secret)};
        secretInput.dispatchEvent(new Event("input", { bubbles: true }));
        const data = new FormData(form);
        if (data.get("role") !== "student") throw new Error("Role was not student before submit");
        if (!String(data.get("student_email") || "").toLowerCase().includes("student")) {
          throw new Error("Student identity was not selected before submit");
        }
        if (!String(data.get("secret") || "")) throw new Error("Secret missing before submit");
        if (!form.checkValidity()) throw new Error("QA login form invalid before submit");
        const submitter = form.querySelector('button[type="submit"]');
        if (!submitter || submitter.disabled) throw new Error("QA login submit unavailable");
        form.requestSubmit(submitter);
        return true;
      })()
    `,
    "qa login student"
  );
  await sleep(2600);
  const url = await evaluate(client, "location.href", "post-login url");
  if (url.includes("/qa-login")) throw new Error("Still on QA login after student submit");
}

async function setUiMode(client, mode) {
  await client.send("Network.setCookie", {
    name: "project_ui_mode",
    value: mode,
    url: baseUrl,
    path: "/",
    secure: true,
    sameSite: "Lax"
  });
}

async function screenshot(client, name) {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const shot = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true
  });
  const filePath = path.join(screenshotDir, name);
  fs.writeFileSync(filePath, Buffer.from(shot.data, "base64"));
  return filePath;
}

async function inspectDashboard(client, mode) {
  await setUiMode(client, mode);
  await goto(client, `${baseUrl}/student`);
  const state = await evaluate(
    client,
    `
      (() => {
        const text = document.body ? document.body.innerText : "";
        const root = document.scrollingElement || document.documentElement;
        const body = document.body;
        const width = Math.max(root.scrollWidth, body ? body.scrollWidth : 0);
        const viewportWidth = window.innerWidth;
        return {
          url: location.href,
          bodyLength: text.trim().length,
          hasFigmaShell: Boolean(document.querySelector(".figma-role-shell")),
          hasRouteClass: Boolean(document.querySelector(".figma-student-dashboard")),
          hasClassicQueue: Boolean(document.querySelector(".action-queue-panel")),
          hasDigest: /Application error|NEXT_REDIRECT|digest/i.test(text),
          isLogin: location.pathname.includes("/qa-login"),
          width,
          viewportWidth,
          overflow: width - viewportWidth,
          linkCount: document.querySelectorAll("a").length
        };
      })()
    `,
    `${mode} student dashboard inspect`
  );
  if (state.isLogin) throw new Error(`${mode}: redirected to QA login`);
  if (state.hasDigest) throw new Error(`${mode}: digest/application error`);
  if (state.bodyLength < 180) throw new Error(`${mode}: shell-only body`);
  if (viewportMode === "mobile" && state.overflow > 4) throw new Error(`${mode}: horizontal overflow ${state.overflow}px`);
  if (mode === "classic") {
    if (state.hasFigmaShell || state.hasRouteClass) throw new Error("classic: unexpected Figma student dashboard");
    if (!state.hasClassicQueue) throw new Error("classic: expected classic action queue panel");
    return { ...state, screenshot: null };
  }
  if (!state.hasFigmaShell) throw new Error("figma: missing Figma shell");
  if (!state.hasRouteClass) throw new Error("figma: missing figma-student-dashboard");
  const filePath = await screenshot(client, `student-dashboard-renderer-figma-${viewportMode}-${deploymentSlug}.png`);
  return { ...state, screenshot: filePath };
}

async function inspectProject(client, mode) {
  await setUiMode(client, mode);
  await goto(client, `${baseUrl}/student/project`);
  const state = await evaluate(
    client,
    `
      (() => {
        const text = document.body ? document.body.innerText : "";
        const root = document.scrollingElement || document.documentElement;
        const body = document.body;
        const width = Math.max(root.scrollWidth, body ? body.scrollWidth : 0);
        const viewportWidth = window.innerWidth;
        const fieldNames = [
          "initial_project_title_th",
          "initial_project_title_en",
          "reason_for_topic",
          "expected_math_area",
          "consultation_summary",
          "tentative_advisor_id",
          "source_type",
          "initial_references",
          "student_declaration"
        ];
        const missingFields = fieldNames.filter((name) => !document.querySelector('[name="' + name + '"]'));
        return {
          url: location.href,
          bodyLength: text.trim().length,
          hasFigmaShell: Boolean(document.querySelector(".figma-role-shell")),
          hasRouteClass: Boolean(document.querySelector(".figma-student-project")),
          hasClassicSummary: Boolean(document.querySelector('[data-testid="student-readability-summary"]')),
          hasDraftSave: Boolean(document.querySelector("[data-draft-save]")),
          hasSubmit: Boolean(document.querySelector('button[type="submit"]')),
          missingFields,
          hasDigest: /Application error|NEXT_REDIRECT|digest/i.test(text),
          isLogin: location.pathname.includes("/qa-login"),
          width,
          viewportWidth,
          overflow: width - viewportWidth
        };
      })()
    `,
    `${mode} student project inspect`
  );
  if (state.isLogin) throw new Error(`${mode}: redirected to QA login`);
  if (state.hasDigest) throw new Error(`${mode}: digest/application error`);
  if (state.bodyLength < 180) throw new Error(`${mode}: shell-only body`);
  if (state.missingFields.length) throw new Error(`${mode}: missing form fields ${state.missingFields.join(", ")}`);
  if (!state.hasDraftSave) throw new Error(`${mode}: missing draft-save button`);
  if (!state.hasSubmit) throw new Error(`${mode}: missing submit button`);
  if (viewportMode === "mobile" && state.overflow > 4) throw new Error(`${mode}: horizontal overflow ${state.overflow}px`);
  if (mode === "classic") {
    if (state.hasFigmaShell || state.hasRouteClass) throw new Error("classic: unexpected Figma student project renderer");
    if (!state.hasClassicSummary) throw new Error("classic: expected classic student readability summary");
    return { ...state, screenshot: null };
  }
  if (!state.hasFigmaShell) throw new Error("figma: missing Figma shell");
  if (!state.hasRouteClass) throw new Error("figma: missing figma-student-project");
  const filePath = await screenshot(client, `student-project-renderer-figma-${viewportMode}-${deploymentSlug}.png`);
  return { ...state, screenshot: filePath };
}

async function inspectProposal(client, mode) {
  await setUiMode(client, mode);
  await goto(client, `${baseUrl}/student/proposal`);
  const state = await evaluate(
    client,
    `
      (() => {
        const text = document.body ? document.body.innerText : "";
        const root = document.scrollingElement || document.documentElement;
        const body = document.body;
        const width = Math.max(root.scrollWidth, body ? body.scrollWidth : 0);
        const viewportWidth = window.innerWidth;
        const fieldNames = [
          "project_title_th",
          "project_title_en",
          "abstract_of_talk",
          "motivation_background",
          "objectives",
          "proposed_methods",
          "expected_outcomes",
          "questions_for_teachers",
          "student_declaration"
        ];
        const hasForm = Boolean(document.querySelector('form [name="project_title_th"]'));
        const missingFields = hasForm ? fieldNames.filter((name) => !document.querySelector('[name="' + name + '"]')) : [];
        return {
          url: location.href,
          bodyLength: text.trim().length,
          hasFigmaShell: Boolean(document.querySelector(".figma-role-shell")),
          hasRouteClass: Boolean(document.querySelector(".figma-student-proposal")),
          hasClassicSummary: Boolean(document.querySelector('[data-testid="student-readability-summary"]')),
          hasSubmittedSummary: Boolean(document.querySelector('[data-testid="student-proposal-submitted-summary"]')),
          hasDraftSave: Boolean(document.querySelector("[data-proposal-draft-save]")),
          hasSubmit: Boolean(document.querySelector('button[type="submit"]')),
          hasForm,
          missingFields,
          hasDigest: /Application error|NEXT_REDIRECT|digest/i.test(text),
          isLogin: location.pathname.includes("/qa-login"),
          width,
          viewportWidth,
          overflow: width - viewportWidth
        };
      })()
    `,
    `${mode} student proposal inspect`
  );
  if (state.isLogin) throw new Error(`${mode}: redirected to QA login`);
  if (state.hasDigest) throw new Error(`${mode}: digest/application error`);
  if (state.bodyLength < 180) throw new Error(`${mode}: shell-only body`);
  if (!state.hasForm && !state.hasSubmittedSummary) throw new Error(`${mode}: missing proposal form/submitted summary`);
  if (state.missingFields.length) throw new Error(`${mode}: missing form fields ${state.missingFields.join(", ")}`);
  if (state.hasForm && !state.hasDraftSave) throw new Error(`${mode}: missing proposal draft-save button`);
  if (state.hasForm && !state.hasSubmit) throw new Error(`${mode}: missing submit button`);
  if (viewportMode === "mobile" && state.overflow > 4) throw new Error(`${mode}: horizontal overflow ${state.overflow}px`);
  if (mode === "classic") {
    if (state.hasFigmaShell || state.hasRouteClass) throw new Error("classic: unexpected Figma student proposal renderer");
    if (!state.hasClassicSummary) throw new Error("classic: expected classic student readability summary");
    return { ...state, screenshot: null };
  }
  if (!state.hasFigmaShell) throw new Error("figma: missing Figma shell");
  if (!state.hasRouteClass) throw new Error("figma: missing figma-student-proposal");
  const filePath = await screenshot(client, `student-proposal-renderer-figma-${viewportMode}-${deploymentSlug}.png`);
  return { ...state, screenshot: filePath };
}

async function main() {
  const client = await connectPage();
  await qaLoginStudent(client);
  const results = [
    { route: "/student", mode: "classic", result: await inspectDashboard(client, "classic") },
    { route: "/student", mode: "figma", result: await inspectDashboard(client, "figma") },
    { route: "/student/project", mode: "classic", result: await inspectProject(client, "classic") },
    { route: "/student/project", mode: "figma", result: await inspectProject(client, "figma") },
    { route: "/student/proposal", mode: "classic", result: await inspectProposal(client, "classic") },
    { route: "/student/proposal", mode: "figma", result: await inspectProposal(client, "figma") }
  ];
  client.ws.close();
  console.log(JSON.stringify({ baseUrl, viewportMode, viewport, studentKey, results }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
