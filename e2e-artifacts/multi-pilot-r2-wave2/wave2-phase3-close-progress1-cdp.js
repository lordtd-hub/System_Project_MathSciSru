const http = require("node:http");

const baseUrl = process.env.QA_PREVIEW_URL || "https://system-project-math-sci-daaspquy0-lordtd-hubs-projects.vercel.app";
const secret = process.env.QA_LIVE_SECRET;
const cdpUrl = process.env.EDGE_CDP_URL || "http://127.0.0.1:9333";
const qaHost = new URL(baseUrl).host;
const expectedOfferingTitle = process.env.WAVE2_EXPECTED_OFFERING_TITLE || "MULTI-PILOT-R2 Wave 2 Course Offering";

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

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function literal(value) {
  return JSON.stringify(value);
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
  await sleep(1300);
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
      secret.value = ${literal(secret)};
      secret.dispatchEvent(new Event("input", { bubbles: true }));
      if (!form.checkValidity()) throw new Error("invalid admin login form");
      form.requestSubmit();
    })()
  `, "qa login admin");
  await sleep(1800);
  const text = await bodyText(client, "after admin login");
  if (!text.includes("ADMIN")) throw new Error("admin role not visible after login");
}

async function main() {
  const client = await connectPage();
  try {
    await qaLoginAdmin(client);
    await goto(client, `${baseUrl}/admin/rounds`);
    const before = await bodyText(client, "admin rounds before close progress1");
    if (!before.includes(expectedOfferingTitle)) throw new Error("Not on Wave 2 offering");
    if (!before.includes("R2STU10") || !before.includes("MULTI-PILOT-R2 Wave 2 Project 10")) {
      throw new Error("Progress 1 close guard did not list W2-10");
    }
    const guardState = await evaluate(client, `
      (() => {
        const forms = Array.from(document.querySelectorAll("form")).filter((form) => {
          const checkbox = form.querySelector('[name="acknowledge_incomplete_projects"]');
          const button = form.querySelector('button[type="submit"]:not([disabled])');
          const section = form.closest("section") || form.parentElement;
          const text = section?.innerText || "";
          return checkbox && button && text.includes("R2STU10") && text.includes("MULTI-PILOT-R2 Wave 2 Project 10");
        });
        return { acknowledgementForms: forms.length };
      })()
    `, "inspect progress1 close guard");
    if (guardState.acknowledgementForms < 1) {
      throw new Error(`Progress 1 close guard did not expose an acknowledgement form for W2-10: ${JSON.stringify(guardState)}`);
    }
    const closeResult = await evaluate(client, `
      (() => {
        const forms = Array.from(document.querySelectorAll("form")).filter((form) => {
          const checkbox = form.querySelector('[name="acknowledge_incomplete_projects"]');
          const button = form.querySelector('button[type="submit"]:not([disabled])');
          const section = form.closest("section") || form.parentElement;
          const text = section?.innerText || "";
          return checkbox && button && text.includes("R2STU10") && text.includes("MULTI-PILOT-R2 Wave 2 Project 10");
        });
        const form = forms[0];
        if (!form) throw new Error("Progress 1 close form with acknowledgement not found");
        const checkbox = form.querySelector('[name="acknowledge_incomplete_projects"]');
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event("input", { bubbles: true }));
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        if (!form.checkValidity()) throw new Error("Progress 1 close form invalid before submit");
        const button = form.querySelector('button[type="submit"]:not([disabled])');
        form.requestSubmit(button);
        return "submitted";
      })()
    `, "close progress1 with acknowledgement");
    await sleep(2000);
    await goto(client, `${baseUrl}/admin/rounds`);
    const after = await bodyText(client, "admin rounds after close progress1");
    const afterState = await evaluate(client, `
      (() => {
        const text = document.body.innerText;
        const stillHasW210Acknowledgement = Array.from(document.querySelectorAll("form")).some((form) => {
          const section = form.closest("section") || form.parentElement;
          return Boolean(form.querySelector('[name="acknowledge_incomplete_projects"]')) && (section?.innerText || "").includes("R2STU10");
        });
        return {
          hasOffering: text.includes(${JSON.stringify(expectedOfferingTitle)}),
          stillHasW210Acknowledgement,
          hasProgress2OpenForm: Array.from(document.querySelectorAll("form")).some((form) => {
            const roundType = form.querySelector('[name="round_type"]');
            const button = form.querySelector('button[type="submit"]:not([disabled])');
            return roundType?.value === "PROGRESS_2" && Boolean(button);
          })
        };
      })()
    `, "inspect progress1 close result");
    if (!afterState.hasOffering || afterState.stillHasW210Acknowledgement) {
      throw new Error(`Progress 1 did not close cleanly after acknowledgement: ${JSON.stringify(afterState)}`);
    }
    console.log(JSON.stringify({ baseUrl, closeResult, guardState, afterState, before: before.slice(0, 1800), after: after.slice(0, 2600) }, null, 2));
  } finally {
    client.ws.close();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});


