const CDP = "http://127.0.0.1:9222";

async function getTarget() {
  const targets = await fetch(`${CDP}/json/list`).then((response) => response.json());
  return targets.find((target) => target.type === "page" && target.url.includes("system-project-math-sci"));
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
  const target = await getTarget();
  if (!target) throw new Error("No app page target.");
  const client = await connect(target.webSocketDebuggerUrl);
  await client.send("Runtime.enable");
  const result = await client.send("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(() => {
      window.confirm = () => true;
      const head = document.querySelector('select[name="head_teacher_id"]');
      const member = document.querySelector('select[name="member_teacher_id"]');
      if (!head || !member) return { submitted: false, reason: 'missing committee selects' };
      const values = [...head.options].map((option) => option.value).filter(Boolean);
      if (values.length < 2) return { submitted: false, reason: 'not enough teachers' };
      head.value = values[0];
      member.value = values[1];
      head.dispatchEvent(new Event('input', { bubbles: true }));
      head.dispatchEvent(new Event('change', { bubbles: true }));
      member.dispatchEvent(new Event('input', { bubbles: true }));
      member.dispatchEvent(new Event('change', { bubbles: true }));
      const button = [...document.querySelectorAll('button')].find((candidate) => candidate.innerText.includes('บันทึกการแต่งตั้ง'));
      if (!button) return { submitted: false, reason: 'missing button' };
      button.scrollIntoView({ block: 'center' });
      button.form?.requestSubmit(button);
      return { submitted: true, head: head.selectedOptions[0]?.textContent, member: member.selectedOptions[0]?.textContent };
    })()`,
  });
  console.log(JSON.stringify(result.result.value, null, 2));
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const state = await client.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `({ url: location.href, text: document.body.innerText.slice(0, 1200) })`,
  });
  console.log(JSON.stringify(state.result.value, null, 2));
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
