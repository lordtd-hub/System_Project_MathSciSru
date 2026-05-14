const http = require("node:http");

const baseUrl = process.env.QA_PREVIEW_URL;
const cdpUrl = process.env.EDGE_CDP_URL || "http://127.0.0.1:9333";
const mode = process.env.UI_MODE === "figma" ? "figma" : "classic";

if (!baseUrl) {
  console.error("QA_PREVIEW_URL is required");
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
  await send("Network.enable");
  await send("Page.bringToFront").catch(() => {});
  return { send, ws };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  await sleep(400);
}

async function main() {
  const client = await connectPage();
  await goto(client, `${baseUrl}/qa-login`);

  const cookie = await client.send("Network.setCookie", {
    name: "project_ui_mode",
    value: mode,
    url: baseUrl,
    path: "/",
    secure: true,
    sameSite: "Lax"
  });
  if (!cookie.success) throw new Error(`Failed to set project_ui_mode cookie to ${mode}`);

  await client.send("Page.reload", { ignoreCache: true });
  await sleep(1000);
  const state = await evaluate(
    client,
    `
      (() => ({
        mode: document.cookie.match(/(?:^|; )project_ui_mode=([^;]+)/)?.[1] || "",
        url: location.href,
        bodyLength: document.body ? document.body.innerText.trim().length : 0
      }))()
    `,
    "verify ui mode cookie"
  );
  if (state.mode !== mode) throw new Error(`UI mode cookie mismatch: ${JSON.stringify(state)}`);
  console.log(JSON.stringify({ baseUrl, mode, state }, null, 2));
  client.ws.close();
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
