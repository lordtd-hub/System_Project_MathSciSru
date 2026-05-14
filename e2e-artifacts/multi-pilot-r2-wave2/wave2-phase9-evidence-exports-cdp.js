const http = require("node:http");

const baseUrl = process.env.QA_PREVIEW_URL || "https://system-project-math-sci-cp2k496sw-lordtd-hubs-projects.vercel.app";
const secret = process.env.QA_LIVE_SECRET;
const cdpUrl = process.env.EDGE_CDP_URL || "http://127.0.0.1:9333";
const qaHost = new URL(baseUrl).host;
const expectedOfferingTitle = process.env.WAVE2_EXPECTED_OFFERING_TITLE || "MULTI-PILOT-R2 Wave 2 Course Offering";

if (!secret) {
  console.error("QA_LIVE_SECRET is required");
  process.exit(2);
}

const exportKinds = ["grades", "projects", "timeline", "scores", "reports", "audit"];

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
  const listeners = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && callbacks.has(message.id)) {
      const { resolve, reject } = callbacks.get(message.id);
      callbacks.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
    if (message.method && listeners.has(message.method)) {
      for (const handler of listeners.get(message.method)) handler(message.params || {});
    }
  });
  function send(method, params = {}) {
    const messageId = ++id;
    ws.send(JSON.stringify({ id: messageId, method, params }));
    return new Promise((resolve, reject) => callbacks.set(messageId, { resolve, reject }));
  }
  function on(method, handler) {
    if (!listeners.has(method)) listeners.set(method, new Set());
    listeners.get(method).add(handler);
  }
  on("Page.javascriptDialogOpening", () => {
    send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
  });
  await send("Page.enable");
  await send("Runtime.enable");
  return { send, ws };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function literal(value) {
  return JSON.stringify(value);
}

async function evaluate(client, expression, label) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  });
  if (result.exceptionDetails) {
    const text = result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime exception";
    throw new Error(`${label}: ${text}`);
  }
  return result.result?.value;
}

async function goto(client, url) {
  await client.send("Page.navigate", { url });
  await sleep(1200);
  await evaluate(client, "document.readyState", `goto ${url}`).catch(() => {});
  await sleep(500);
}

async function bodyText(client, label) {
  const text = await evaluate(client, "document.body ? document.body.innerText : ''", label);
  if (!text || text.trim().length < 120) throw new Error(`${label}: shell-only or blank body`);
  if (/Application error|NEXT_REDIRECT|digest/i.test(text)) throw new Error(`${label}: error/digest page`);
  return text;
}

async function qaLoginAdmin(client) {
  await goto(client, `${baseUrl}/qa-login`);
  await evaluate(client, `
    (() => {
      const form = document.querySelector("form:has(#secret)");
      if (!form) throw new Error("Missing QA login form");
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
      setSelect("#role", "admin");
      setSelect("#admin_email", "multi-r2-admin");
      const secret = document.querySelector("#secret");
      if (!secret) throw new Error("Missing #secret");
      secret.value = ${literal(secret)};
      secret.dispatchEvent(new Event("input", { bubbles: true }));
      if (!form.checkValidity()) throw new Error("invalid admin login form");
      form.requestSubmit();
      return true;
    })()
  `, "qa login admin");
  await sleep(1800);
  const text = await bodyText(client, "after admin login");
  if (!text.includes("ADMIN")) throw new Error("admin role not visible after login");
}

async function main() {
  const client = await connectPage();
  const result = { baseUrl, courseOfferingId: "", pageExcerpt: "", exports: [] };
  try {
    await qaLoginAdmin(client);
    await goto(client, `${baseUrl}/admin/evidence`);
    const pageText = await bodyText(client, "admin evidence");
    result.pageExcerpt = pageText.slice(0, 2200);
    result.courseOfferingId = await evaluate(client, `
      (() => {
        const select = document.querySelector('select[name="course_offering_id"]');
        if (!select) return "";
        const option = Array.from(select.options).find((item) => item.textContent.includes(expectedOfferingTitle)) || select.selectedOptions[0];
        if (!option) return "";
        select.value = option.value;
        return option.value;
      })()
    `, "selected expected offering");
    if (!result.courseOfferingId) throw new Error("Expected course offering option not found on evidence page");
    for (const kind of exportKinds) {
      for (const format of ["csv", "xlsx"]) {
        const query = kind === "audit"
          ? (format === "xlsx" ? "?format=xlsx" : "")
          : `?course_offering_id=${encodeURIComponent(result.courseOfferingId)}${format === "xlsx" ? "&format=xlsx" : ""}`;
        const href = `/admin/evidence/exports/${kind}${query}`;
        const check = await evaluate(client, `
          (async () => {
            const response = await fetch(${literal(href)}, { credentials: "include" });
            const contentType = response.headers.get("content-type") || "";
            const disposition = response.headers.get("content-disposition") || "";
            if (${literal(format)} === "xlsx") {
              const buffer = await response.arrayBuffer();
              return { kind: ${literal(kind)}, format: ${literal(format)}, status: response.status, contentType, disposition, byteLength: buffer.byteLength };
            }
            const text = await response.text();
            return { kind: ${literal(kind)}, format: ${literal(format)}, status: response.status, contentType, disposition, byteLength: text.length, sample: text.slice(0, 700) };
          })()
        `, `fetch export ${kind} ${format}`);
        if (check.status !== 200) throw new Error(`Export ${kind} ${format} returned ${check.status}`);
        if (check.byteLength < 50) throw new Error(`Export ${kind} ${format} looked too small: ${check.byteLength}`);
        if (kind === "grades" && format === "csv") {
          for (const expected of ["student_code", "first_name_th", "last_name_th", "proposal_10_percent", "progress1_10_percent", "progress2_10_percent", "final_10_percent", "advisor_25_percent", "recorded_total_65_percent", "R2STU01"]) {
            if (!check.sample.includes(expected) && !String(check.byteLength).includes(expected)) {
              const full = await evaluate(client, `
                (async () => {
                  const response = await fetch(${literal(href)}, { credentials: "include" });
                  return await response.text();
                })()
              `, "fetch full grades csv");
              if (!full.includes(expected)) throw new Error(`Grades CSV missing expected content: ${expected}`);
            }
          }
        }
        result.exports.push(check);
      }
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    client.ws.close();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});


