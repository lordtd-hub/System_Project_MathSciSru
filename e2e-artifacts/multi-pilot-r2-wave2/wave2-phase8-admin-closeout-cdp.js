const http = require("node:http");

const baseUrl = process.env.QA_PREVIEW_URL || "https://system-project-math-sci-cp2k496sw-lordtd-hubs-projects.vercel.app";
const secret = process.env.QA_LIVE_SECRET;
const cdpUrl = process.env.EDGE_CDP_URL || "http://127.0.0.1:9333";
const qaHost = new URL(baseUrl).host;

if (!secret) {
  console.error("QA_LIVE_SECRET is required");
  process.exit(2);
}

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

async function qaLoginAdmin(client) {
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
      setSelect("#role", "admin");
      setSelect("#admin_email", "multi-r2-admin");
      const secret = document.querySelector("#secret");
      if (!secret) throw new Error("Missing #secret");
      secret.value = ${literal(secret)};
      secret.dispatchEvent(new Event("input", { bubbles: true }));
      if (!form.checkValidity()) throw new Error("invalid admin login form");
      form.requestSubmit();
      return true;
    })()
  `, "qa login admin");
  await sleep(1800);
  const text = await bodyText(client, "after admin login");
  if (!text.includes("ADMIN")) throw new Error("admin role not visible after login");
}

async function closeoutVisibleWave2Projects(client) {
  let submitted = 0;
  let inspected = "";
  for (let attempt = 0; attempt < 20; attempt++) {
    await goto(client, `${baseUrl}/admin/closeout`);
    const text = await bodyText(client, "admin closeout");
    inspected = text.slice(0, 2200);
    const result = await evaluate(client, `
      (() => {
        const forms = Array.from(document.querySelectorAll("form")).filter((form) => {
          const projectId = form.querySelector('[name="project_id"]')?.value;
          if (!projectId) return false;
          const card = form.closest("article") || form.closest("section") || form.parentElement;
          const text = card?.innerText || "";
          return text.includes("MULTI-PILOT-R2 Wave 2 Project");
        });
        const form = forms[0];
        if (!form) return { status: "none", remaining: 0 };
        const card = form.closest("article") || form.closest("section") || form.parentElement;
        const text = card?.innerText || "";
        for (const expected of ["ครบแล้ว", "คะแนนสรุปของอาจารย์ที่ปรึกษา 25%", "รายงานฉบับสมบูรณ์ผ่านการตรวจ"]) {
          if (!text.includes(expected)) throw new Error("Closeout card missing expected evidence text: " + expected);
        }
        const button = form.querySelector('button[type="submit"]:not([disabled])');
        if (!button) throw new Error("Closeout submit button not enabled");
        if (!form.checkValidity()) throw new Error("Closeout form invalid before submit");
        const cardText = text.slice(0, 500);
        form.requestSubmit(button);
        return { status: "submitted", remaining: forms.length, cardText };
      })()
    `, "admin closeout wave2 project");
    if (result.status !== "submitted") break;
    submitted += 1;
    await sleep(1800);
  }
  return { submitted, inspected };
}

async function main() {
  const client = await connectPage();
  const result = { baseUrl, closeout: null, after: "" };
  try {
    await qaLoginAdmin(client);
    result.closeout = await closeoutVisibleWave2Projects(client);
    if (result.closeout.submitted !== 12) {
      throw new Error(`Expected 12 Wave 2 closeouts, submitted ${result.closeout.submitted}`);
    }
    await goto(client, `${baseUrl}/admin/closeout`);
    result.after = (await bodyText(client, "admin closeout after wave2")).slice(0, 3000);
    if (!result.after.includes("MULTI-PILOT-R2 Wave 2 Project 12") || !result.after.includes("โครงงานเสร็จสมบูรณ์")) {
      throw new Error("Wave 2 completed closeout evidence not visible after submit");
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
