const CDP = "http://127.0.0.1:9222";
const text = process.argv[2];

if (!text) {
  console.error("Usage: node cdp-click-button-confirm.mjs <button text>");
  process.exit(1);
}

async function getTarget() {
  const targets = await fetch(`${CDP}/json/list`).then((response) => response.json());
  return targets.find((target) => target.type === "page" && target.url.includes("system-project-math-sci"));
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  let client;
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Page.javascriptDialogOpening" && client) {
      void client.send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
    }
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    }
  };
  return new Promise((resolve, reject) => {
    ws.onerror = reject;
    ws.onopen = () => {
      client = {
        send(method, params = {}) {
          const messageId = ++id;
          ws.send(JSON.stringify({ id: messageId, method, params }));
          return new Promise((resolveMessage, rejectMessage) => pending.set(messageId, { resolve: resolveMessage, reject: rejectMessage }));
        },
        close() {
          ws.close();
        },
      };
      resolve(client);
    };
  });
}

async function main() {
  const target = await getTarget();
  if (!target) throw new Error("No app page target.");
  const client = await connect(target.webSocketDebuggerUrl);
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  const result = await client.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const candidates = [...document.querySelectorAll('button')]
        .map((candidate) => {
          candidate.scrollIntoView({ block: 'center' });
          const rect = candidate.getBoundingClientRect();
          return { candidate, rect };
        });
      const item = candidates.find(({ candidate, rect }) =>
        candidate.innerText.includes(${JSON.stringify(text)}) &&
        !candidate.disabled &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom >= 0 &&
        rect.right >= 0 &&
        rect.top <= window.innerHeight &&
        rect.left <= window.innerWidth
      );
      const button = item?.candidate;
      if (!button) {
        return { found: false, buttons: [...document.querySelectorAll('button')].map((candidate) => ({ text: candidate.innerText, disabled: candidate.disabled })) };
      }
      button.scrollIntoView({ block: 'center' });
      const rect = button.getBoundingClientRect();
      return { found: true, click: { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) } };
    })()`,
  });
  console.log(JSON.stringify(result.result.value, null, 2));
  if (!result.result.value?.found) {
    client.close();
    return;
  }
  const { x, y } = result.result.value.click;
  await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const state = await client.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `({ url: location.href, text: document.body.innerText.slice(0, 1000) })`,
  });
  console.log(JSON.stringify(state.result.value, null, 2));
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
