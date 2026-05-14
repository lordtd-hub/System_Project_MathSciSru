const http = require("node:http");

const baseUrl = process.env.QA_PREVIEW_URL;
const secret = process.env.QA_LIVE_SECRET;
const cdpUrl = process.env.EDGE_CDP_URL || "http://127.0.0.1:9333";
const formInputId = process.env.PREPARE_FORM_INPUT_ID || "prepare_r2_redesign_secret";
const successText = process.env.PREPARE_SUCCESS_TEXT || "Prepared MULTI-PILOT-R2 redesign regression QA data.";
const offeringText = process.env.PREPARE_OFFERING_TEXT || "MULTI-PILOT-R2 Redesign Regression Course Offering";

if (!baseUrl) {
  console.error("QA_PREVIEW_URL is required");
  process.exit(2);
}

if (!secret) {
  console.error("QA_LIVE_SECRET is required");
  process.exit(2);
}

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
  await send("Page.bringToFront").catch(() => {});
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
  await sleep(600);
}

async function main() {
  const client = await connectPage();
  await goto(client, `${baseUrl}/qa-login`);

  const submitted = await evaluate(
    client,
    `
      (() => {
        const input = document.querySelector("#${formInputId}");
        if (!input) throw new Error("Missing redesign regression setup field");
        const form = input.closest("form");
        if (!form) throw new Error("Missing redesign regression setup form");
        input.value = ${literal(secret)};
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        if (!form.checkValidity()) throw new Error("Redesign setup form invalid");
        const button = form.querySelector('button[type="submit"]');
        if (!button || button.disabled) throw new Error("Redesign setup submit unavailable");
        form.requestSubmit(button);
        return true;
      })()
    `,
    "submit redesign regression setup"
  );
  if (!submitted) throw new Error("Redesign regression setup did not submit");

  await sleep(3500);
  const state = await evaluate(
    client,
    `
      (() => {
        const text = document.body ? document.body.innerText : "";
        return {
          url: location.href,
          bodyLength: text.trim().length,
          hasSuccess: text.includes(${literal(successText)}),
          hasOffering: text.includes(${literal(offeringText)}),
          hasError: /incorrect|disabled|error|Application error|digest/i.test(text)
        };
      })()
    `,
    "verify redesign regression setup"
  );
  if (state.hasError) throw new Error(`Setup returned error-like page: ${JSON.stringify(state)}`);
  if (!state.hasSuccess && !state.hasOffering) throw new Error(`Setup success not visible: ${JSON.stringify(state)}`);

  console.log(JSON.stringify({ baseUrl, state }, null, 2));
  client.ws.close();
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
