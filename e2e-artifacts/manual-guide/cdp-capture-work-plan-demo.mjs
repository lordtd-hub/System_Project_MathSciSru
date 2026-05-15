import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const CDP = "http://127.0.0.1:9222";
const QA_URL =
  process.env.QA_PREVIEW_URL ||
  "https://system-project-math-sci-8nu3416ka-lordtd-hubs-projects.vercel.app";
const QA_SECRET = process.env.QA_LOGIN_SECRET;

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getTarget() {
  if (process.env.CREATE_NEW_TAB === "1") {
    return fetch(`${CDP}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" }).then((response) => response.json());
  }
  const targets = await fetch(`${CDP}/json/list`).then((response) => response.json());
  const page =
    targets.find((target) => target.type === "page" && target.url.includes("system-project-math-sci")) ||
    targets.find((target) => target.type === "page" && target.url.includes("127.0.0.1")) ||
    targets.find((target) => target.type === "page");
  if (!page) throw new Error("No visible page target found.");
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

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function waitReady(client, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await evaluate(client, "document.readyState !== 'loading'").catch(() => false);
    if (ready) return;
    await delay(300);
  }
  throw new Error("Timed out waiting for page readiness.");
}

async function navigate(client, route) {
  const url = route.startsWith("http") ? route : `${QA_URL}${route}`;
  await client.send("Page.navigate", { url });
  await waitReady(client);
  await delay(1500);
}

async function loginIfRequested(client) {
  const role = process.env.LOGIN_ROLE;
  const identityValue = process.env.LOGIN_ID;
  if (!role && !identityValue) return;
  if (!role || !identityValue || !QA_SECRET) {
    throw new Error("LOGIN_ROLE, LOGIN_ID, and QA_LOGIN_SECRET are required together.");
  }
  await navigate(client, "/qa-login");
  await evaluate(
    client,
    `(() => {
      const setSelect = (selector, value) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error('Missing ' + selector);
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const role = ${JSON.stringify(role)};
      setSelect('#role', role);
      setSelect(role === 'student' ? '#student_email' : role === 'teacher' ? '#teacher_email' : '#admin_email', ${JSON.stringify(identityValue)});
      const secret = document.querySelector('#secret');
      if (!secret) throw new Error('Missing secret');
      secret.value = ${JSON.stringify(QA_SECRET)};
      secret.dispatchEvent(new Event('input', { bubbles: true }));
      secret.closest('form').requestSubmit();
      return true;
    })()`,
  );
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const ok = await evaluate(client, `location.pathname.startsWith('/${role}')`).catch(() => false);
    if (ok) return;
    await delay(500);
  }
  throw new Error(`Login did not reach /${role}`);
}

async function main() {
  const outputPath =
    process.argv[2] ||
    "public/manual/screenshots/student/student-04-work-plan-week-selector.png";
  const target = await getTarget();
  const client = await connect(target.webSocketDebuggerUrl);

  try {
    await client.send("Runtime.enable");
    await client.send("Page.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await loginIfRequested(client);
    await navigate(client, "/student/proposal");

    const state = await evaluate(
      client,
      `(() => ({
        url: location.href,
        title: document.title,
        hasTimeline: document.body.innerText.includes('แผนการดำเนินงาน 16 สัปดาห์'),
        needsLogin: Boolean(document.querySelector('#role')) && document.body.innerText.includes('เลือกบัญชีทดสอบ')
      }))()`,
    );
    if (state.needsLogin || !state.hasTimeline) {
      throw new Error(`Student proposal form with timeline is not available: ${JSON.stringify(state)}`);
    }

    for (let count = 0; count < 4; count += 1) {
      const currentCount = await evaluate(client, `document.querySelectorAll('[id^="timeline_activity_"]').length`);
      if (currentCount >= 4) break;
      await evaluate(
        client,
        `(() => {
          const addButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('เพิ่มงาน'));
          if (!addButton) throw new Error('Missing add work-plan row button');
          addButton.click();
          return true;
        })()`,
      );
      await delay(300);
    }

    const captureState = await evaluate(
      client,
      `(() => {
        const tasks = [
          {
            activity: 'ศึกษางานวิจัยที่เกี่ยวข้องและสรุปกรอบแนวคิด',
            start: '1',
            end: '4',
            deliverable: 'สรุปเอกสารอ้างอิงและประเด็นวิจัยเบื้องต้น'
          },
          {
            activity: 'ออกแบบวิธีดำเนินงานและกำหนดข้อมูลที่จะใช้',
            start: '3',
            end: '6',
            deliverable: 'แผนวิธีดำเนินงานและรายการข้อมูลที่ต้องเตรียม'
          },
          {
            activity: 'เก็บข้อมูล ทดลอง หรือพัฒนาเครื่องมือ',
            start: '5',
            end: '10',
            deliverable: 'ชุดข้อมูล/ต้นแบบ/ผลการทดลองรอบแรก'
          },
          {
            activity: 'วิเคราะห์ผล ปรับปรุง และเตรียมนำเสนอความก้าวหน้า',
            start: '9',
            end: '13',
            deliverable: 'ผลวิเคราะห์เบื้องต้นและสไลด์สำหรับ Progress'
          }
        ];
        const setValue = (name, value) => {
          const el = document.querySelector('#' + name);
          if (!el) throw new Error('Missing field ' + name);
          const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
          descriptor?.set ? descriptor.set.call(el, value) : (el.value = value);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        tasks.forEach((task, index) => {
          setValue('timeline_activity_' + index, task.activity);
          setValue('timeline_start_' + index, task.start);
          setValue('timeline_end_' + index, task.end);
          setValue('timeline_deliverable_' + index, task.deliverable);
        });
        const section =
          document.querySelector('#timeline_activity_0')?.closest('div.space-y-3') ||
          document.querySelector('#timeline_activity_0')?.closest('div.md\\\\:col-span-2') ||
          document.querySelector('#timeline_activity_0')?.parentElement?.parentElement?.parentElement;
        if (!section) throw new Error('Missing timeline section container');
        section.scrollIntoView({ block: 'center' });
        const rect = section.getBoundingClientRect();
        return {
          taskCount: document.querySelectorAll('[id^="timeline_activity_"]').length,
          text: section.innerText.slice(0, 800),
          clip: {
            x: Math.max(0, rect.left - 20 + window.scrollX),
            y: Math.max(0, rect.top - 20 + window.scrollY),
            width: Math.min(window.innerWidth - 20, rect.width + 40),
            height: Math.min(900, rect.height + 40),
            scale: 1
          }
        };
      })()`,
    );

    await delay(500);
    const shot = await client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
      clip: captureState.clip,
    });

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, Buffer.from(shot.data, "base64"));
    console.log(JSON.stringify({ outputPath, ...captureState }, null, 2));
  } finally {
    await client.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
    client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
