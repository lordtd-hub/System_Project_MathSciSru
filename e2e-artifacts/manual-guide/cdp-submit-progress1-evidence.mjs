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
      const set = (name, value) => {
        const el = document.querySelector('[name="' + name + '"]');
        if (!el) return false;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };
      set('submission_title', 'หลักฐานความก้าวหน้าครั้งที่ 1 สำหรับคู่มือ');
      set('material_link', 'https://drive.google.com/drive/folders/manual-progress1-demo');
      set('progress_plan_tasks', 'สัปดาห์ 1-8: ศึกษาเอกสาร ออกแบบวิธีดำเนินงาน และเตรียมข้อมูลตัวอย่าง');
      set('progress_evidence', 'แนบเอกสารสรุปความก้าวหน้าและหลักฐานการทดลองเบื้องต้นในลิงก์เอกสาร');
      set('progress_status', 'ดำเนินการตามแผนและมีผลเบื้องต้นสำหรับนำเสนอรอบความก้าวหน้าครั้งที่ 1');
      set('progress_challenges_next', 'ปรับรายละเอียดผลการทดลองและเตรียมแผนสำหรับรอบถัดไป');
      const invalid = [...document.querySelectorAll('input, textarea, select')]
        .filter((el) => !el.checkValidity())
        .map((el) => ({ name: el.name || '(unnamed)', type: el.type, message: el.validationMessage }));
      if (invalid.length) return { submitted: false, reason: 'invalid fields', invalid };
      const button = [...document.querySelectorAll('button')].find((candidate) => candidate.innerText.includes('บันทึกเอกสาร สอบความก้าวหน้าครั้งที่ 1'));
      if (!button) return { submitted: false, reason: 'missing button' };
      button.scrollIntoView({ block: 'center' });
      button.form?.requestSubmit(button);
      return { submitted: true, text: button.innerText };
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
