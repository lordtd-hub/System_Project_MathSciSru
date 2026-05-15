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
    ws.onopen = () => {
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
    };
  });
}

async function main() {
  const target = await getTarget();
  const client = await connect(target.webSocketDebuggerUrl);
  await client.send("Runtime.enable");
  await client.send("Page.enable");

  const navigateTo = process.argv[2];
  if (navigateTo) {
    await client.send("Page.navigate", { url: navigateTo });
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const ready = await client.send("Runtime.evaluate", {
        returnByValue: true,
        expression: "document.readyState !== 'loading'",
      });
      if (ready.result.value) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  const result = await client.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const controls = [...document.querySelectorAll('select,input,textarea,button,a')].slice(0, 120).map((el) => ({
        tag: el.tagName,
        type: el.getAttribute('type') || '',
        text: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 120),
        name: el.getAttribute('name') || '',
        id: el.id || '',
        required: Boolean(el.required),
        disabled: Boolean(el.disabled),
        valid: typeof el.checkValidity === 'function' ? el.checkValidity() : undefined,
        value: 'value' in el ? String(el.value || '').slice(0, 120) : undefined,
        href: el.getAttribute('href') || '',
        options: el.tagName === 'SELECT'
          ? [...el.options].map((option) => ({ value: option.value, text: option.textContent.trim() }))
          : undefined,
      }));
      return {
        url: location.href,
        title: document.title,
        body: document.body.innerText.slice(0, 2000),
        controls,
      };
    })()`,
  });

  console.log(JSON.stringify(result.result.value, null, 2));
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
