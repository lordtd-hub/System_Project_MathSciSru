const CDP = "http://127.0.0.1:9222";

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
    awaitPromise: true,
    returnByValue: true,
    expression: `(() => {
      const setSelectMax = (select) => {
        const values = [...select.options].map((option) => Number(option.value)).filter((value) => Number.isFinite(value));
        if (!values.length) return;
        select.value = String(Math.max(...values));
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      };

      document.querySelectorAll('select[name^="condition_count:"]').forEach(setSelectMax);

      const decision = document.querySelector('select[name="decision"]');
      if (decision) {
        decision.value = 'PASS';
        decision.dispatchEvent(new Event('input', { bubbles: true }));
        decision.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const reason = document.querySelector('[name="reason"]');
      if (reason) {
        reason.value = '';
        reason.dispatchEvent(new Event('input', { bubbles: true }));
        reason.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const comment = document.querySelector('[name="overall_comment"]');
      if (comment) {
        comment.value = 'ผ่านตามเกณฑ์สำหรับตัวอย่างคู่มือการใช้งาน สามารถใช้เป็นภาพประกอบขั้นตอนการประเมินได้';
        comment.dispatchEvent(new Event('input', { bubbles: true }));
        comment.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const invalid = [...document.querySelectorAll('input, textarea, select')]
        .filter((el) => !el.checkValidity())
        .map((el) => ({ name: el.name || '(unnamed)', type: el.type, message: el.validationMessage }));
      if (invalid.length) return { submitted: false, reason: 'invalid fields', invalid };

      const buttons = [...document.querySelectorAll('button')];
      const submit = buttons.find((button) => button.innerText.includes('ส่งคะแนน') || button.innerText.includes('บันทึกคะแนน'));
      if (!submit) return { submitted: false, reason: 'missing submit', buttons: buttons.map((button) => button.innerText) };
      submit.scrollIntoView({ block: 'center' });
      const rect = submit.getBoundingClientRect();
      return {
        ready: true,
        url: location.href,
        click: {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
        },
      };
    })()`,
  });
  console.log(JSON.stringify(result.result.value, null, 2));
  if (!result.result.value?.ready) {
    client.close();
    return;
  }
  const { x, y } = result.result.value.click;
  await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const after = await client.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `({ url: location.href, text: document.body.innerText.slice(0, 1200) })`,
  });
  console.log(JSON.stringify(after.result.value, null, 2));
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
