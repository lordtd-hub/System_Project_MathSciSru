import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const CDP = "http://127.0.0.1:9222";

async function getTarget() {
  const targets = await fetch(`${CDP}/json/list`).then((response) => response.json());
  const page = targets.find((target) => target.type === "page" && target.url.includes("system-project-math-sci"));
  if (!page) throw new Error("No app page target.");
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
          return new Promise((resolveMessage, rejectMessage) => pending.set(messageId, { resolve: resolveMessage, reject: rejectMessage }));
        },
        close() {
          ws.close();
        },
      });
  });
}

async function main() {
  const outputPath = process.argv[2];
  if (!outputPath) throw new Error("Usage: node cdp-capture-current.mjs <outputPath>");

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
  const state = await client.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `({ url: location.href, h1: document.querySelector('h1')?.innerText || '', text: document.body.innerText.slice(0, 500) })`,
  });
  const shot = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(shot.data, "base64"));
  console.log(JSON.stringify({ ...state.result.value, outputPath }, null, 2));
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
