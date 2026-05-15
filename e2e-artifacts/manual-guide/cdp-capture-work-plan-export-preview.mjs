import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const CDP = "http://127.0.0.1:9222";
const outputPath =
  process.argv[2] ||
  "public/manual/screenshots/student/student-04-work-plan-export-preview.png";

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

async function main() {
  const targets = await fetch(`${CDP}/json/list`).then((response) => response.json());
  const pageTargets = targets.filter((target) => target.type === "page" && target.url.includes("/student/proposal"));
  let page = null;
  for (const target of pageTargets) {
    const probe = await connect(target.webSocketDebuggerUrl);
    try {
      await probe.send("Runtime.enable");
      const hasDemoPlan = await evaluate(
        probe,
        `document.body.innerText.includes('ศึกษางานวิจัยที่เกี่ยวข้องและสรุปกรอบแนวคิด') && document.body.innerText.includes('Export แผนงาน CSV')`,
      ).catch(() => false);
      if (hasDemoPlan) {
        page = target;
        break;
      }
    } finally {
      probe.close();
    }
  }
  page = page || pageTargets.at(-1) || targets.find((target) => target.type === "page" && target.url.includes("system-project-math-sci"));
  if (!page) throw new Error("No student proposal page target found.");

  const client = await connect(page.webSocketDebuggerUrl);
  try {
    await client.send("Runtime.enable");
    await client.send("Page.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await evaluate(
      client,
      `(() => {
        const exportButton = Array.from(document.querySelectorAll('button')).find((button) =>
          button.textContent?.includes('Export แผนงาน CSV')
        );
        exportButton?.scrollIntoView({ block: 'start' });
        window.scrollBy(0, -32);
        return true;
      })()`,
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    const clip = await evaluate(
      client,
      `(() => {
        const preview = Array.from(document.querySelectorAll('div'))
          .filter((el) => el.textContent?.includes('ตัวอย่างแผนงาน 16 สัปดาห์ที่จะส่ง'))
          .map((el) => ({ el, rect: el.getBoundingClientRect() }))
          .filter(({ rect }) => rect.width > 400 && rect.height > 120 && rect.height < 700)
          .sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height)[0]?.el;
        if (!preview) throw new Error('Missing work-plan preview');
        const actions = Array.from(document.querySelectorAll('button')).find((button) =>
          button.textContent?.includes('Export แผนงาน CSV')
        )?.parentElement;
        const previewRect = preview.getBoundingClientRect();
        const actionsRect = actions?.getBoundingClientRect() ?? previewRect;
        const left = Math.min(previewRect.left, actionsRect.left);
        const top = Math.min(previewRect.top, actionsRect.top);
        const right = Math.max(previewRect.right, actionsRect.right);
        const bottom = previewRect.bottom;
        return {
          x: Math.max(0, left - 16),
          y: Math.max(0, top - 16),
          width: Math.min(window.innerWidth - 24, right - left + 32),
          height: Math.min(620, bottom - top + 32),
          scale: 1
        };
      })()`,
    );
    const screenshot = await client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
      clip,
    });
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, Buffer.from(screenshot.data, "base64"));
    console.log(JSON.stringify({ outputPath, clip }, null, 2));
  } finally {
    await client.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
    client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
