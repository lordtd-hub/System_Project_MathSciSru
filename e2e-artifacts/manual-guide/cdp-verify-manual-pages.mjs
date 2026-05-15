const CDP = "http://127.0.0.1:9222";
const base = process.env.MANUAL_BASE_URL ?? "http://127.0.0.1:3000";
const routes = ["/manual", "/manual/student", "/manual/teacher"];

async function listTargets() {
  return fetch(`${CDP}/json/list`).then((response) => response.json());
}

async function ensureManualTarget() {
  const targets = await listTargets();
  const existing = targets.find((target) => target.type === "page" && target.url.startsWith(base));
  if (existing) return existing;
  return fetch(`${CDP}/json/new?${encodeURIComponent(`${base}/manual`)}`, { method: "PUT" }).then((response) => response.json());
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
          return new Promise((resolveMessage, rejectMessage) =>
            pending.set(messageId, { resolve: resolveMessage, reject: rejectMessage })
          );
        },
        close() {
          ws.close();
        }
      });
  });
}

async function waitForLoad(client) {
  for (let i = 0; i < 80; i += 1) {
    const result = await client.send("Runtime.evaluate", {
      expression: "document.readyState",
      returnByValue: true
    });
    if (result.result.value === "complete") return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function inspectPage(client, route, width) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width < 600
  });
  await client.send("Page.navigate", { url: `${base}${route}` });
  await waitForLoad(client);
  const result = await client.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const bodyText = document.body?.innerText || "";
      const imgs = Array.from(document.images);
      return {
        title: document.title,
        path: location.pathname,
        width: innerWidth,
        height: innerHeight,
        imageCount: imgs.length,
        brokenImages: imgs.filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.getAttribute("src")),
        hasPlaceholder: bodyText.includes("รอภาพจาก QA จริง"),
        hasMojibake: /เธ|โ€|เน€/.test(bodyText),
        hasManualThai: bodyText.includes("คู่มือ"),
        hasStudentCriteriaText: bodyText.includes("อ่านเกณฑ์การประเมินก่อนวางแผนการนำเสนอ") || bodyText.includes("อ่านเกณฑ์ประเมิน Final"),
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
        headings: Array.from(document.querySelectorAll("h1,h2")).slice(0, 8).map((el) => el.innerText)
      };
    })()`
  });
  return result.result.value;
}

async function main() {
  const target = await ensureManualTarget();
  const client = await connect(target.webSocketDebuggerUrl);
  await client.send("Page.enable");
  await client.send("Runtime.enable");

  const checks = [];
  for (const width of [1366, 390]) {
    for (const route of routes) {
      checks.push(await inspectPage(client, route, width));
    }
  }

  client.close();
  console.log(JSON.stringify(checks, null, 2));

  const failures = checks.filter(
    (check) =>
      check.brokenImages.length ||
      check.hasPlaceholder ||
      check.hasMojibake ||
      !check.hasManualThai ||
      check.horizontalOverflow
  );
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
