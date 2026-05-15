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
  const decision = (process.argv[2] || "APPROVE").toUpperCase();
  const comment = process.argv[3] || "ขอเปลี่ยนวันสอบเป็นช่วงบ่าย เนื่องจากกรรมการติดภารกิจในเวลาที่เสนอมา";
  if (!["APPROVE", "REJECT"].includes(decision)) throw new Error("Decision must be APPROVE or REJECT.");

  const target = await getTarget();
  const client = await connect(target.webSocketDebuggerUrl);
  await client.send("Runtime.enable");
  const result = await client.send("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(() => {
      window.confirm = () => true;
      const decisionInput = [...document.querySelectorAll('input[name="decision"]')]
        .find((input) => input.value === ${JSON.stringify(decision)});
      const form = decisionInput?.closest('form');
      if (!form) return { submitted: false, reason: 'missing decision form', decision: ${JSON.stringify(decision)}, url: location.href };
      const textarea = form.querySelector('textarea[name="comment"]');
      if (${JSON.stringify(decision)} === 'REJECT' && textarea) {
        textarea.value = textarea.value || ${JSON.stringify(comment)};
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const button = [...form.querySelectorAll('button')].find((candidate) => !candidate.disabled);
      if (!button) return { submitted: false, reason: 'missing enabled button', decision: ${JSON.stringify(decision)}, url: location.href };
      button.scrollIntoView({ block: 'center' });
      form.requestSubmit(button);
      return { submitted: true, decision: ${JSON.stringify(decision)}, button: button.innerText, url: location.href };
    })()`,
  });
  console.log(JSON.stringify(result.result.value, null, 2));
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
