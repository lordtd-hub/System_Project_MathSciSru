const http = require("node:http");
const fs = require("node:fs");

const CDP = process.env.CDP_URL || "http://127.0.0.1:9333";
const QA_HOST = "system-project-math-sci-29rpu93od-lordtd-hubs-projects.vercel.app";

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
  const targets = await getJson(`${CDP}/json/list`);
  const pageTarget = targets.find((target) => target.type === "page" && target.url.includes(QA_HOST));
  if (!pageTarget) throw new Error(`No QA preview page found for ${QA_HOST}`);
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.once = (event, handler) => ws.addEventListener(event, handler, { once: true });
    ws.once("open", resolve);
    ws.once("error", reject);
  });

  let id = 0;
  const callbacks = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && callbacks.has(message.id)) {
      const { resolve, reject } = callbacks.get(message.id);
      callbacks.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  });

  function send(method, params = {}) {
    const messageId = ++id;
    ws.send(JSON.stringify({ id: messageId, method, params }));
    return new Promise((resolve, reject) => callbacks.set(messageId, { resolve, reject }));
  }

  await send("Runtime.enable");
  await send("Page.enable");
  return { ws, send };
}

async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  }
  return result.result.value;
}

async function waitFor(send, predicateSource, label, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ok = await evaluate(send, predicateSource);
    if (ok) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function screenshot(send, path) {
  const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  fs.mkdirSync(require("node:path").dirname(path), { recursive: true });
  fs.writeFileSync(path, Buffer.from(result.data, "base64"));
}

async function main() {
  const command = process.argv[2] || "state";
  const { ws, send } = await connectPage();
  try {
    if (command === "state") {
      const state = await evaluate(
        send,
        `(() => ({ url: location.href, title: document.title, text: document.body.innerText.slice(0, 2000) }))()`
      );
      console.log(JSON.stringify(state, null, 2));
    } else if (command === "login-admin") {
      const secret = process.env.QA_SECRET;
      if (!secret) throw new Error("QA_SECRET env var is required");
      await evaluate(
        send,
        `(() => {
          if (!location.href.includes('/qa-login')) return { ok: false, reason: 'not on qa-login', url: location.href };
          const role = document.querySelector('select[name="role"]');
          const admin = document.querySelector('select[name="admin_email"]');
          const secret = document.querySelector('input[name="secret"]');
          if (!role || !admin || !secret) return { ok: false, reason: 'missing login fields' };
          role.value = 'admin';
          role.dispatchEvent(new Event('change', { bubbles: true }));
          admin.value = 'multi-pilot-r2-admin';
          admin.dispatchEvent(new Event('change', { bubbles: true }));
          secret.value = ${JSON.stringify(secret)};
          secret.dispatchEvent(new Event('input', { bubbles: true }));
          const button = Array.from(document.querySelectorAll('button')).find((item) => item.textContent.includes('เข้าสู่ระบบ QA'));
          if (!button) return { ok: false, reason: 'login button missing' };
          button.click();
          return { ok: true };
        })()`
      );
      await waitFor(send, `(() => location.pathname.startsWith('/admin'))()`, "admin redirect");
      console.log("login-admin: PASS");
    } else if (command === "goto") {
      const path = process.argv[3];
      if (!path || !path.startsWith("/")) throw new Error("Usage: goto /path");
      await send("Page.navigate", { url: `https://${QA_HOST}${path}` });
      await waitFor(send, `(() => document.readyState === 'complete' || document.readyState === 'interactive')()`, "navigation");
      console.log(await evaluate(send, `location.href`));
    } else if (command === "verify-admin-rounds") {
      const state = await evaluate(
        send,
        `(() => {
          const text = document.body.innerText;
          return {
            url: location.href,
            hasCompactTitle: text.includes('จัดการผู้ส่งย้อนหลัง') || text.includes('นักศึกษาที่พลาดรอบ'),
            hasExceptionLink: Array.from(document.querySelectorAll('a')).some((a) => a.href.includes('/admin/round-exceptions')),
            textareaCount: document.querySelectorAll('textarea[name="reason"]').length,
            buttonCount: Array.from(document.querySelectorAll('button')).filter((button) => button.textContent.includes('เปิดส่งย้อนหลัง')).length,
            sample: text.slice(0, 2000)
          };
        })()`
      );
      console.log(JSON.stringify(state, null, 2));
      if (!state.hasExceptionLink) throw new Error("Missing admin round-exceptions link");
      if (state.textareaCount > 3 || state.buttonCount > 3) throw new Error("Late exception form list still appears too large on /admin/rounds");
    } else if (command === "verify-exceptions") {
      const state = await evaluate(
        send,
        `(() => {
          const text = document.body.innerText;
          return {
            url: location.href,
            hasTitle: text.includes('จัดการผู้ส่งย้อนหลัง') || text.includes('นักศึกษาที่พลาดรอบ'),
            hasRoundFilter: text.includes('รอบสอบ'),
            hasStatusFilter: text.includes('สถานะ'),
            hasSearch: text.includes('ค้นหา'),
            rowCount: document.querySelectorAll('tbody tr').length,
            detailsCount: document.querySelectorAll('details').length,
            sample: text.slice(0, 2000)
          };
        })()`
      );
      console.log(JSON.stringify(state, null, 2));
      if (!state.hasTitle || !state.hasSearch) throw new Error("Exception list page missing expected controls");
      if (state.detailsCount < 1) throw new Error("No expandable exception rows found");
    } else if (command === "screenshot") {
      const path = process.argv[3];
      if (!path) throw new Error("Usage: screenshot <path>");
      await screenshot(send, path);
      console.log(path);
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
  } finally {
    ws.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
