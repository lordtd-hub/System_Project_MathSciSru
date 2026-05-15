const CDP = "http://127.0.0.1:9222";

const inputRound = (process.argv[2] || "PROGRESS_2").toUpperCase();
const round = inputRound === "FINAL_PRESENT" ? "FINAL_PRESENTATION" : inputRound;
const configs = {
  PROGRESS_2: {
    date: "2026-06-02",
    start: "10:00",
    end: "11:00",
    room: "MS-401",
    note: "เสนอวันสอบความก้าวหน้าครั้งที่ 2 สำหรับคู่มือการใช้งาน",
  },
  FINAL_PRESENTATION: {
    date: "2026-06-09",
    start: "09:00",
    end: "10:00",
    room: "MS-501",
    note: "เสนอวันสอบนำเสนอขั้นสุดท้ายสำหรับคู่มือการใช้งาน",
  },
};

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
  const config = configs[round];
  if (!config) throw new Error("Unsupported round. Use PROGRESS_2 or FINAL_PRESENTATION.");

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
      const roundSelect = [...document.querySelectorAll('select[name="round_type"]')]
        .find((select) => [...select.options].some((option) => option.value === ${JSON.stringify(round)}));
      if (roundSelect) {
        roundSelect.value = ${JSON.stringify(round)};
        roundSelect.dispatchEvent(new Event('input', { bubbles: true }));
        roundSelect.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        set('round_type', ${JSON.stringify(round)});
      }
      set('schedule_date', ${JSON.stringify(config.date)});
      set('start_time', ${JSON.stringify(config.start)});
      set('end_time', ${JSON.stringify(config.end)});
      set('room', ${JSON.stringify(config.room)});
      set('schedule_note', ${JSON.stringify(config.note)});
      const invalid = [...document.querySelectorAll('input, textarea, select')]
        .filter((el) => !el.checkValidity())
        .map((el) => ({ name: el.name || '(unnamed)', type: el.type, message: el.validationMessage }));
      if (invalid.length) return { submitted: false, reason: 'invalid fields', invalid };
      const button = [...document.querySelectorAll('button')].find((candidate) => candidate.innerText.includes('ส่งข้อเสนอวันสอบ'));
      if (!button) return { submitted: false, reason: 'missing button', url: location.href };
      button.scrollIntoView({ block: 'center' });
      button.form?.requestSubmit(button);
      return { submitted: true, round: ${JSON.stringify(round)}, text: button.innerText, url: location.href };
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
