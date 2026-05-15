import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const CDP = "http://127.0.0.1:9222";
const QA_URL =
  process.env.QA_PREVIEW_URL ||
  "https://system-project-math-sci-8nu3416ka-lordtd-hubs-projects.vercel.app";
const QA_SECRET = process.env.QA_LOGIN_SECRET;

async function getTarget() {
  const targets = await fetch(`${CDP}/json/list`).then((response) => response.json());
  const page =
    targets.find((target) => target.type === "page" && target.url.includes("system-project-math-sci")) ||
    targets.find((target) => target.type === "page");
  if (!page) throw new Error("No page target found.");
  return page;
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    }
  };
  return new Promise((resolve, reject) => {
    ws.onerror = reject;
    ws.onopen = () =>
      resolve({
        send(method, params = {}) {
          const messageId = ++id;
          ws.send(JSON.stringify({ id: messageId, method, params }));
          return new Promise((resolveMessage, rejectMessage) => {
            pending.set(messageId, { resolve: resolveMessage, reject: rejectMessage });
          });
        },
        close() {
          ws.close();
        },
      });
  });
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function waitReady(client, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await evaluate(client, "document.readyState !== 'loading'").catch(() => false);
    if (ready) return;
    await delay(500);
  }
  throw new Error("Timed out waiting for page");
}

async function navigate(client, routeOrUrl) {
  const url = routeOrUrl.startsWith("http") || routeOrUrl.startsWith("file:") ? routeOrUrl : `${QA_URL}${routeOrUrl}`;
  await client.send("Page.navigate", { url });
  await waitReady(client, 30000);
  await delay(1000);
}

async function loginIfRequested(client) {
  const role = process.env.LOGIN_ROLE;
  const identityValue = process.env.LOGIN_ID;
  if (!role && !identityValue) return;
  if (!role || !identityValue || !QA_SECRET) {
    throw new Error("LOGIN_ROLE, LOGIN_ID, and QA_LOGIN_SECRET are required together.");
  }
  await navigate(client, "/qa-login");
  await evaluate(
    client,
    `(() => {
      const setSelect = (selector, value) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error('Missing ' + selector);
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const role = ${JSON.stringify(role)};
      setSelect('#role', role);
      setSelect(role === 'student' ? '#student_email' : role === 'teacher' ? '#teacher_email' : '#admin_email', ${JSON.stringify(identityValue)});
      const secret = document.querySelector('#secret');
      secret.value = ${JSON.stringify(QA_SECRET)};
      secret.dispatchEvent(new Event('input', { bubbles: true }));
      secret.closest('form').requestSubmit();
      return true;
    })()`,
  );
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const ok = await evaluate(client, `location.pathname.startsWith('/${role}')`).catch(() => false);
    if (ok) return;
    await delay(500);
  }
  throw new Error(`Login did not reach /${role}`);
}

async function main() {
  const route = process.argv[2];
  const outputPath = process.argv[3];
  if (!route || !outputPath) throw new Error("Usage: node cdp-capture-one.mjs <route> <outputPath>");

  const target = await getTarget();
  const client = await connect(target.webSocketDebuggerUrl);
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: Number(process.env.VIEWPORT_WIDTH || 1440),
    height: Number(process.env.VIEWPORT_HEIGHT || 950),
    deviceScaleFactor: 1,
    mobile: false,
  });
  await loginIfRequested(client);
  await navigate(client, route);
  await evaluate(client, "window.scrollTo(0, 0); true");
  await delay(500);
  const state = await evaluate(client, "({ url: location.href, h1: document.querySelector('h1')?.innerText || '', text: document.body.innerText.slice(0, 500) })");
  const shot = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(shot.data, "base64"));
  console.log(JSON.stringify({ ...state, outputPath }, null, 2));
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
