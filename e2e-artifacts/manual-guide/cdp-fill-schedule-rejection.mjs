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
  const comment = process.argv[2] || "ขอเปลี่ยนวันสอบเป็นช่วงบ่าย เนื่องจากกรรมการติดภารกิจในเวลาที่เสนอมา";
  const target = await getTarget();
  const client = await connect(target.webSocketDebuggerUrl);
  await client.send("Runtime.enable");
  const result = await client.send("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(() => {
      const rejectDecision = [...document.querySelectorAll('input[name="decision"]')]
        .find((input) => input.value === 'REJECT');
      const form = rejectDecision?.closest('form');
      const textarea = form?.querySelector('textarea[name="comment"]');
      const button = form ? [...form.querySelectorAll('button')].find((candidate) => candidate.innerText.includes('ไม่อนุมัติ')) : null;
      if (!textarea || !button) {
        return { filled: false, reason: 'missing reject form', url: location.href };
      }
      textarea.value = ${JSON.stringify(comment)};
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      button.scrollIntoView({ block: 'center' });
      return { filled: true, comment: textarea.value, button: button.innerText, url: location.href };
    })()`,
  });
  console.log(JSON.stringify(result.result.value, null, 2));
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
