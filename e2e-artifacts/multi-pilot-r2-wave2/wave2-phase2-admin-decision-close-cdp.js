const http = require("node:http");

const baseUrl = process.env.QA_PREVIEW_URL || "https://system-project-math-sci-daaspquy0-lordtd-hubs-projects.vercel.app";
const secret = process.env.QA_LIVE_SECRET;
const cdpUrl = process.env.EDGE_CDP_URL || "http://127.0.0.1:9333";
const qaHost = new URL(baseUrl).host;

if (!secret) {
  console.error("QA_LIVE_SECRET is required");
  process.exit(2);
}

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

async function saveDecisions(client) {
  const saved = [];
  for (let guard = 0; guard < 20; guard++) {
    await goto(client, `${baseUrl}/admin/proposals`);
    await bodyText(client, "admin proposals");
    const decision = await evaluate(client, `
      (() => {
        const forms = Array.from(document.querySelectorAll('form:has(select[name="final_decision"])'));
        const form = forms.find((item) => {
          let node = item;
          let text = item.innerText || "";
          for (let depth = 0; depth < 8 && node; depth += 1, node = node.parentElement) {
            text += "\\n" + (node.innerText || "");
            if (text.includes("MULTI-PILOT-R2 Wave 2 Project")) break;
          }
          return text.includes("MULTI-PILOT-R2 Wave 2 Project") && !text.includes("decided_at:");
        });
        if (!form) return null;
        let node = form;
        let text = form.innerText || "";
        for (let depth = 0; depth < 8 && node; depth += 1, node = node.parentElement) text += "\\n" + (node.innerText || "");
        const title = (text.match(/MULTI-PILOT-R2 Wave 2 Project \\d+/) || ["Wave2 project"])[0];
        form.querySelector('select[name="final_decision"]').value = "PASS";
        const reason = form.querySelector('input[name="final_decision_reason"]');
        if (reason) {
          reason.value = "Wave 2 Proposal passed after full internal scoring.";
          reason.dispatchEvent(new Event("input", { bubbles: true }));
        }
        const submit = form.querySelector('button[type="submit"]:not([disabled])');
        if (!submit) return { status: "locked", title };
        form.requestSubmit(submit);
        return { status: "submitted", title };
      })()
    `, "save final decision");
    if (!decision) break;
    saved.push(decision);
    await sleep(1800);
  }
  return saved;
}

async function closeProposalRound(client) {
  await goto(client, `${baseUrl}/admin/rounds`);
  await bodyText(client, "admin rounds before close proposal");
  const result = await evaluate(client, `
    (() => {
      const forms = Array.from(document.querySelectorAll('form:has(input[name="round_id"])'));
      const form = forms.find((item) => {
        let node = item;
        let text = item.innerText || "";
        for (let depth = 0; depth < 8 && node; depth += 1, node = node.parentElement) {
          text += "\\n" + (node.innerText || "");
          if (text.includes("การเสนอหัวข้อ")) break;
        }
        return text.includes("การเสนอหัวข้อ") && item.querySelector('input[name="acknowledge_missing_projects"]');
      });
      if (!form) return "not-found";
      const ack = form.querySelector('input[name="acknowledge_missing_projects"]');
      if (ack) ack.checked = true;
      const submit = form.querySelector('button[type="submit"]:not([disabled])');
      if (!submit) return "not-actionable";
      form.requestSubmit(submit);
      return "submitted";
    })()
  `, "close proposal round");
  if (result === "submitted") await sleep(1800);
  await goto(client, `${baseUrl}/admin/rounds`);
  const text = await bodyText(client, "admin rounds after close proposal");
  return { result, sample: text.slice(0, 1600) };
}

async function main() {
  const client = await connectPage();
  await qaAdmin(client);
  const decisions = await saveDecisions(client);
  const close = await closeProposalRound(client);
  console.log(JSON.stringify({ baseUrl, decisions, close }, null, 2));
  client.ws.close();
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
