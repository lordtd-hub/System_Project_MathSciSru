const CDP = "http://127.0.0.1:9222";
const versionLabel = process.argv[2] || "v1";

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
  const target = await getTarget();
  const client = await connect(target.webSocketDebuggerUrl);
  await client.send("Runtime.enable");
  const result = await client.send("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(() => {
      window.confirm = () => true;
      const set = (name, value) => {
        const el = document.querySelector('[name="' + name + '"]');
        if (!el) return false;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };
      set('report_drive_link', ${JSON.stringify(`https://drive.google.com/drive/folders/manual-report-${versionLabel}`)});
      set('report_note', ${JSON.stringify(versionLabel === 'v1' ? 'ส่งรายงานฉบับแรกสำหรับคู่มือการใช้งาน' : 'ส่งรายงานฉบับแก้ไขตามข้อเสนอแนะของอาจารย์ผู้ตรวจ')});
      const invalid = [...document.querySelectorAll('input, textarea, select')]
        .filter((el) => !el.checkValidity())
        .map((el) => ({ name: el.name || '(unnamed)', type: el.type, message: el.validationMessage }));
      if (invalid.length) return { submitted: false, reason: 'invalid fields', invalid };
      const button = [...document.querySelectorAll('button')].find((candidate) =>
        candidate.innerText.includes('ส่งเล่มรายงานฉบับสมบูรณ์') ||
        candidate.innerText.includes('ส่งฉบับใหม่')
      );
      if (!button) return { submitted: false, reason: 'missing submit button', url: location.href };
      button.scrollIntoView({ block: 'center' });
      button.form?.requestSubmit(button);
      return { submitted: true, versionLabel: ${JSON.stringify(versionLabel)}, text: button.innerText, url: location.href };
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
