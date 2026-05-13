const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const baseUrl =
  process.env.QA_PREVIEW_URL ||
  "https://system-project-math-sci-de5ss9vy1-lordtd-hubs-projects.vercel.app";
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

const routes = [
  { route: "/admin/rounds", className: "figma-admin-rounds", name: "admin-rounds" },
  { route: "/admin/closeout", className: "figma-admin-closeout", name: "admin-closeout" },
  { route: "/admin/proposals", className: "figma-admin-proposals", name: "admin-proposals" },
  { route: "/admin/schedules", className: "figma-admin-schedules", name: "admin-schedules" },
  { route: "/admin/evidence", className: "figma-admin-evidence", name: "admin-evidence" }
];

function readPreviewSecret() {
  if (process.env.QA_LIVE_SECRET) return process.env.QA_LIVE_SECRET;
  const envPath = path.join(process.cwd(), ".env.preview.local");
  const body = fs.readFileSync(envPath, "utf8");
  const match = body.match(/^QA_LOGIN_SECRET=(?:"([^"]+)"|'([^']+)'|(.+))$/m);
  if (!match) throw new Error("QA_LOGIN_SECRET not found");
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
    const text =
      result.exceptionDetails.exception?.description ||
      result.exceptionDetails.text ||
      "Runtime exception";
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

async function qaLoginAdmin(client) {
  await goto(client, `${baseUrl}/qa-login`);
  await evaluate(
    client,
    `
      (() => {
        const roleSelect = document.querySelector("#role");
        if (!roleSelect) throw new Error("Missing #role");
        const form = roleSelect.closest("form");
        if (!form) throw new Error("Missing QA login form");
        const setSelect = (selector, preferred) => {
          const el = form.querySelector(selector);
          if (!el) throw new Error("Missing " + selector);
          const normalized = String(preferred).toLowerCase();
          const option = Array.from(el.options).find((item) => {
            const value = String(item.value || "").toLowerCase();
            const text = String(item.textContent || "").toLowerCase();
            return value === normalized || value.includes(normalized) || text.includes(normalized);
          });
          if (!option) throw new Error("Missing option " + preferred + " for " + selector);
          el.value = option.value;
          Array.from(el.options).forEach((item) => {
            item.selected = item === option;
          });
          el.selectedIndex = option.index;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        };
        setSelect("#role", "admin");
        setSelect("#admin_email", "admin");
        const secretInput = form.querySelector("#secret");
        if (!secretInput) throw new Error("Missing #secret");
        secretInput.value = ${literal(secret)};
        secretInput.dispatchEvent(new Event("input", { bubbles: true }));
        const data = new FormData(form);
        if (data.get("role") !== "admin") throw new Error("Role was not admin before submit");
        if (!String(data.get("admin_email") || "").toLowerCase().includes("admin")) {
          throw new Error("Admin identity was not selected before submit");
        }
        if (!String(data.get("secret") || "")) throw new Error("Secret missing before submit");
        if (!form.checkValidity()) throw new Error("QA login form invalid before submit");
        const submitter = form.querySelector('button[type="submit"]');
        if (!submitter || submitter.disabled) throw new Error("QA login submit unavailable");
        form.requestSubmit(submitter);
        return true;
      })()
    `,
    "qa login admin"
  );
  await sleep(2600);
  const url = await evaluate(client, "location.href", "post-login url");
  if (url.includes("/qa-login")) {
    const body = await evaluate(client, "document.body ? document.body.innerText.slice(0, 320) : ''", "post-login body");
    throw new Error(`Still on QA login after admin submit; body=${body.replace(/\s+/g, " ")}`);
  }
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

async function inspectRoute(client, routeSpec, mode) {
  await setUiMode(client, mode);
  await goto(client, `${baseUrl}${routeSpec.route}`);
  const state = await evaluate(
    client,
    `
      (() => {
        const text = document.body ? document.body.innerText : "";
        const root = document.scrollingElement || document.documentElement;
        const body = document.body;
        const width = Math.max(root.scrollWidth, body ? body.scrollWidth : 0);
        const viewportWidth = window.innerWidth;
        const buttons = Array.from(document.querySelectorAll("button, a")).map((item) => ({
          text: (item.textContent || "").trim().slice(0, 80),
          disabled: Boolean(item.disabled),
          href: item.href || null
        }));
        return {
          url: location.href,
          bodyLength: text.trim().length,
          hasFigmaShell: Boolean(document.querySelector(".figma-role-shell")),
          hasRouteClass: Boolean(document.querySelector(".${routeSpec.className}")),
          routeClassCount: document.querySelectorAll(".${routeSpec.className}").length,
          hasDigest: /Application error|NEXT_REDIRECT|digest/i.test(text),
          isLogin: location.pathname.includes("/qa-login"),
          width,
          viewportWidth,
          overflow: width - viewportWidth,
          formCount: document.forms.length,
          buttonCount: buttons.length
        };
      })()
    `,
    `${routeSpec.route} ${mode} inspect`
  );

  if (state.isLogin) throw new Error(`${routeSpec.route} ${mode}: redirected to QA login`);
  if (state.hasDigest) throw new Error(`${routeSpec.route} ${mode}: digest/application error`);
  if (state.bodyLength < 180) throw new Error(`${routeSpec.route} ${mode}: shell-only body`);
  if (viewportMode === "mobile" && state.overflow > 4) {
    throw new Error(`${routeSpec.route} ${mode}: horizontal overflow ${state.overflow}px`);
  }
  if (mode === "classic") {
    if (state.hasFigmaShell) throw new Error(`${routeSpec.route} classic: unexpected Figma shell`);
    if (state.hasRouteClass) throw new Error(`${routeSpec.route} classic: unexpected ${routeSpec.className}`);
    return { ...state, screenshot: null };
  }
  if (!state.hasFigmaShell) throw new Error(`${routeSpec.route} figma: missing Figma shell`);
  if (!state.hasRouteClass) throw new Error(`${routeSpec.route} figma: missing ${routeSpec.className}`);
  const filePath = await screenshot(
    client,
    `${routeSpec.name}-renderer-${mode}-${viewportMode}-${deploymentSlug}.png`
  );
  return { ...state, screenshot: filePath };
}

async function main() {
  const client = await connectPage();
  const results = [];
  await qaLoginAdmin(client);
  for (const routeSpec of routes) {
    results.push({ route: routeSpec.route, mode: "classic", result: await inspectRoute(client, routeSpec, "classic") });
    results.push({ route: routeSpec.route, mode: "figma", result: await inspectRoute(client, routeSpec, "figma") });
  }
  client.ws.close();
  console.log(JSON.stringify({ baseUrl, viewportMode, viewport, results }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
