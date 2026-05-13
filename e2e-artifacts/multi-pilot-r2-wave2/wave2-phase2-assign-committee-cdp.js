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
const roleMap = Array.from({ length: 12 }, (_, index) => ({
  projectNo: index + 1,
  title: `MULTI-PILOT-R2 Wave 2 Project ${pad2(index + 1)}`,
  headLabel: `MULTI-PILOT-R2 Teacher ${pad2(((index + 3) % 11) + 1)}`,
  memberLabel: `MULTI-PILOT-R2 Teacher ${pad2(((index + 7) % 11) + 1)}`
}));

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
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
    }).on("error", reject);
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
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && callbacks.has(message.id)) {
      const { resolve, reject } = callbacks.get(message.id);
      callbacks.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
    if (message.method === "Page.javascriptDialogOpening") {
      send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
    }
  });
  function send(method, params = {}) {
    const messageId = ++id;
    ws.send(JSON.stringify({ id: messageId, method, params }));
    return new Promise((resolve, reject) => callbacks.set(messageId, { resolve, reject }));
  }
  await send("Page.enable");
  await send("Runtime.enable");
  return { send, ws };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function evaluate(client, expression, label) {
  const result = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) {
    const text = result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime exception";
    throw new Error(`${label}: ${text}`);
  }
  return result.result?.value;
}

async function goto(client, url) {
  await client.send("Page.navigate", { url });
  await sleep(1200);
}

async function bodyText(client, label) {
  const text = await evaluate(client, "document.body ? document.body.innerText : ''", label);
  if (!text || text.trim().length < 120) throw new Error(`${label}: shell-only or blank body`);
  if (/Application error|NEXT_REDIRECT|digest/i.test(text)) throw new Error(`${label}: error/digest page`);
  return text;
}

async function qaAdmin(client) {
  await goto(client, `${baseUrl}/qa-login`);
  await evaluate(client, `
    (() => {
      const form = document.querySelector("form:has(#secret)");
      const setSelect = (selector, value) => {
        const el = document.querySelector(selector);
        const option = Array.from(el.options).find((item) => item.value === value || item.textContent.includes(value));
        if (!option) throw new Error("Missing option " + value + " for " + selector);
        el.value = option.value;
        option.selected = true;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      setSelect("#role", "admin");
      setSelect("#admin_email", "multi-r2-admin");
      document.querySelector("#secret").value = ${JSON.stringify(secret)};
      document.querySelector("#secret").dispatchEvent(new Event("input", { bubbles: true }));
      if (!form.checkValidity()) throw new Error("invalid login form");
      form.requestSubmit();
    })()
  `, "qa admin login");
  await sleep(1600);
  await bodyText(client, "after admin login");
}

async function assignOne(client, item) {
  await goto(client, `${baseUrl}/admin/committee`);
  await bodyText(client, `committee before ${item.title}`);
  const result = await evaluate(client, `
    (() => {
      const title = ${JSON.stringify(item.title)};
      const headLabel = ${JSON.stringify(item.headLabel)};
      const memberLabel = ${JSON.stringify(item.memberLabel)};
      const forms = Array.from(document.querySelectorAll('form:has(input[name="project_id"])'));
      const form = forms.find((item) => {
        let node = item;
        let text = item.innerText || "";
        for (let depth = 0; depth < 8 && node; depth += 1, node = node.parentElement) {
          text += "\\n" + (node.innerText || "");
          if (text.includes(title)) break;
        }
        return text.includes(title);
      });
      if (!form) return { status: "not-found", title };
      const choose = (selector, label) => {
        const select = form.querySelector(selector);
        if (!select) throw new Error("Missing " + selector);
        const option = Array.from(select.options).find((item) => item.textContent.includes(label));
        if (!option) throw new Error("Missing option " + label);
        select.value = option.value;
        option.selected = true;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      };
      choose('select[name="head_teacher_id"]', headLabel);
      choose('select[name="member_teacher_id"]', memberLabel);
      if (!form.checkValidity()) throw new Error("committee form invalid for " + title);
      const submit = form.querySelector('button[type="submit"]:not([disabled])');
      if (!submit) return { status: "not-actionable", title };
      form.requestSubmit(submit);
      return { status: "submitted", title, headLabel, memberLabel };
    })()
  `, `assign committee ${item.title}`);
  if (result.status === "submitted") await sleep(1800);
  await bodyText(client, `committee after ${item.title}`);
  return result;
}

async function main() {
  const client = await connectPage();
  await qaAdmin(client);
  const assigned = [];
  for (const item of roleMap) {
    assigned.push(await assignOne(client, item));
  }
  await goto(client, `${baseUrl}/admin/rounds`);
  const rounds = await bodyText(client, "admin rounds after committee assignments");
  console.log(JSON.stringify({ baseUrl, assigned, roundsSample: rounds.slice(0, 1800) }, null, 2));
  client.ws.close();
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
