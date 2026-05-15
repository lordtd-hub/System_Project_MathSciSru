const CDP = "http://127.0.0.1:9222";

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

async function main() {
  const buttonText = process.argv.slice(2).join(" ");
  if (!buttonText) throw new Error("Button text is required.");
  const target = await getTarget();
  const client = await connect(target.webSocketDebuggerUrl);
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  const result = await client.send("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(() => {
      const targetText = ${JSON.stringify(buttonText)};
      const button = [...document.querySelectorAll('button')].find((item) =>
        item.innerText.trim().includes(targetText)
      );
      if (!button) return { clicked: false, url: location.href, buttons: [...document.querySelectorAll('button')].map((item) => item.innerText.trim()) };
      button.scrollIntoView({ block: 'center' });
      button.click();
      return { clicked: true, text: button.innerText.trim(), url: location.href };
    })()`,
  });
  console.log(JSON.stringify(result.result.value, null, 2));
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const after = await client.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `({ url: location.href, body: document.body.innerText.slice(0, 1000) })`,
  });
  console.log(JSON.stringify(after.result.value, null, 2));
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
