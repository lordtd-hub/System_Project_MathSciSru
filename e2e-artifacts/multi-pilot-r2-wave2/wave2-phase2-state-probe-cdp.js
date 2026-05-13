const http = require("node:http");

const baseUrl = process.env.QA_PREVIEW_URL || "https://system-project-math-sci-daaspquy0-lordtd-hubs-projects.vercel.app";
const secret = process.env.QA_LIVE_SECRET;
const cdpUrl = process.env.EDGE_CDP_URL || "http://127.0.0.1:9333";
const qaHost = new URL(baseUrl).host;

if (!secret) {
  console.error("QA_LIVE_SECRET is required");
  process.exit(2);
}

const pad2 = (value) => String(value).padStart(2, "0");
const studentKey = (n) => `multi-r2-student-${pad2(n)}`;
const teacherKey = (n) => `multi-r2-teacher-${pad2(n)}`;

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

async function connectPage() {
  const targets = await getJson(`${cdpUrl}/json/list`);
  const target = targets.find((item) => item.type === "page" && item.url.includes(qaHost)) || targets.find((item) => item.type === "page");
  if (!target) throw new Error("No Edge page target found");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const callbacks = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && callbacks.has(message.id)) {
      const { resolve, reject } = callbacks.get(message.id);
      callbacks.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  });
  function send(method, params = {}) {
    const messageId = ++id;
    ws.send(JSON.stringify({ id: messageId, method, params }));
    return new Promise((resolve, reject) => callbacks.set(messageId, { resolve, reject }));
  }
  await send("Page.enable");
  await send("Runtime.enable");
  return { send, ws };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function evaluate(client, expression, label) {
  const result = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) {
    const text = result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime exception";
    throw new Error(`${label}: ${text}`);
  }
  return result.result?.value;
}

async function goto(client, url) {
  await client.send("Page.navigate", { url });
  await sleep(1200);
}

async function qaLogin(client, role, key) {
  const roleValue = role.toLowerCase();
  await goto(client, `${baseUrl}/qa-login`);
  await evaluate(client, `
    (() => {
      const form = document.querySelector("form:has(#secret)");
      const setSelect = (selector, value) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error("Missing " + selector);
        const option = Array.from(el.options).find((item) => item.value === value || item.textContent.includes(value));
        if (!option) throw new Error("Missing option " + value + " for " + selector);
        el.value = option.value;
        option.selected = true;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      setSelect("#role", ${JSON.stringify(roleValue)});
      if (${JSON.stringify(roleValue)} === "admin") setSelect("#admin_email", "multi-r2-admin");
      if (${JSON.stringify(roleValue)} === "student") setSelect("#student_email", ${JSON.stringify(key)});
      if (${JSON.stringify(roleValue)} === "teacher") setSelect("#teacher_email", ${JSON.stringify(key)});
      document.querySelector("#secret").value = ${JSON.stringify(secret)};
      document.querySelector("#secret").dispatchEvent(new Event("input", { bubbles: true }));
      if (!form.checkValidity()) throw new Error("invalid login form");
      form.requestSubmit();
      return true;
    })()
  `, `qa login ${role} ${key || ""}`);
  await sleep(1600);
}

async function pageSummary(client, url) {
  await goto(client, url);
  return evaluate(client, `
    (() => ({
      url: location.href,
      title: document.title,
      text: document.body.innerText.slice(0, 2400),
      enabledSubmitForms: Array.from(document.querySelectorAll("form")).filter((form) => form.querySelector('button[type="submit"]:not([disabled])')).length,
      disabledSubmitForms: Array.from(document.querySelectorAll("form")).filter((form) => form.querySelector('button[type="submit"][disabled]')).length,
      projectStatus: document.querySelector('[class*="StatusBadge"], .status-badge')?.textContent || ""
    }))()
  `, `summary ${url}`);
}

async function main() {
  const client = await connectPage();
  const result = { baseUrl, students: [], teacherAdvisorCounts: [], admin: {} };
  for (let n = 1; n <= 12; n++) {
    await qaLogin(client, "student", studentKey(n));
    result.students.push({
      n,
      project: await pageSummary(client, `${baseUrl}/student/project`),
      proposal: await pageSummary(client, `${baseUrl}/student/proposal`)
    });
  }
  for (let n = 1; n <= 11; n++) {
    await qaLogin(client, "teacher", teacherKey(n));
    const summary = await pageSummary(client, `${baseUrl}/teacher/advisor-requests`);
    result.teacherAdvisorCounts.push({ n, enabledSubmitForms: summary.enabledSubmitForms, sample: summary.text.slice(0, 600) });
  }
  await qaLogin(client, "admin");
  result.admin.rounds = await pageSummary(client, `${baseUrl}/admin/rounds`);
  result.admin.proposals = await pageSummary(client, `${baseUrl}/admin/proposals`);
  console.log(JSON.stringify(result, null, 2));
  client.ws.close();
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
