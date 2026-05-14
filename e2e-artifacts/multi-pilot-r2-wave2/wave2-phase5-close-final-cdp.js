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

async function finalRoundSection(client, label) {
  return evaluate(client, `
    (() => {
      const sections = Array.from(document.querySelectorAll("section"));
      const section = sections.find((item) => {
        const text = item.innerText || "";
        return text.includes("เธฃเธญเธ เธเธฒเธฃเธชเธญเธเธเธณเน€เธชเธเธญเธเธฑเนเธเธชเธธเธ”เธ—เนเธฒเธข") && text.includes("เธชเนเธเธซเธฅเธฑเธเธเธฒเธเธฃเธญเธเธเธตเนเนเธฅเนเธง");
      });
      if (!section) return null;
      return section.innerText;
    })()
  `, label);
}

async function main() {
  const client = await connectPage();
  try {
    await qaLoginAdmin(client);
    await goto(client, `${baseUrl}/admin/rounds`);
    const beforeText = await bodyText(client, "admin rounds before close final");
    if (!beforeText.includes(expectedOfferingTitle)) throw new Error("Not on Wave 2 offering");
    const beforeSection = await finalRoundSection(client, "final round section before close");
    if (!beforeSection) throw new Error("Final round section not visible before close");
    for (const expected of ["เน€เธเธดเธ”เธญเธขเธนเน", "เธเธฃเนเธญเธกเน€เธเนเธฒเธชเธนเนเธฃเธญเธเธเธตเน\n12", "เธชเนเธเธซเธฅเธฑเธเธเธฒเธเธฃเธญเธเธเธตเนเนเธฅเนเธง\n12", "เธเธฃเธฐเน€เธกเธดเธเธฃเธญเธเธเธตเนเธเธฃเธ\n12", "เธเธฃเนเธญเธกเนเธ•เนเธขเธฑเธเนเธกเนเธเธฃเธ\n0", "เธขเธฑเธเนเธกเนเธเธฃเนเธญเธกเธฃเธญเธเธเธตเน\n0"]) {
      if (!beforeSection.includes(expected)) throw new Error(`Final close guard mismatch before close: missing ${expected}`);
    }
    const closeResult = await evaluate(client, `
      (() => {
        const forms = Array.from(document.querySelectorAll("form"));
        const form = forms.find((candidate) => {
          const button = candidate.querySelector('button[type="submit"]:not([disabled])');
          const section = candidate.closest("section") || candidate.parentElement;
          const text = section?.innerText || "";
          return button && text.includes("เธฃเธญเธ เธเธฒเธฃเธชเธญเธเธเธณเน€เธชเธเธญเธเธฑเนเธเธชเธธเธ”เธ—เนเธฒเธข") && (button.innerText || "").includes("เธเธดเธ”เธฃเธญเธ");
        });
        if (!form) {
          return {
            status: "not-found",
            forms: forms.map((candidate) => {
              const section = candidate.closest("section") || candidate.parentElement;
              const button = candidate.querySelector('button[type="submit"]');
              return {
                disabled: Boolean(button?.disabled),
                buttonText: button?.innerText || "",
                text: (section?.innerText || "").slice(0, 500)
              };
            })
          };
        }
        const ack = form.querySelector('[name="acknowledge_incomplete_projects"]');
        if (ack) throw new Error("Final close unexpectedly requires incomplete acknowledgement with completed counters");
        if (!form.checkValidity()) throw new Error("Final close form invalid before submit");
        const button = form.querySelector('button[type="submit"]:not([disabled])');
        form.requestSubmit(button);
        return { status: "submitted" };
      })()
    `, "close final");
    if (closeResult.status !== "submitted") {
      throw new Error("No enabled Final close form found: " + JSON.stringify(closeResult));
    }
    await sleep(2200);
    await goto(client, `${baseUrl}/admin/rounds`);
    const afterText = await bodyText(client, "admin rounds after close final");
    if (!afterText.includes(expectedOfferingTitle)) throw new Error("Not on Wave 2 offering after close");
    const afterSection = await finalRoundSection(client, "final round section after close");
    if (!afterSection) throw new Error("Final round section not visible after close");
    if (!afterSection.includes("เธเธดเธ”เนเธฅเนเธง")) throw new Error("Final round did not show closed after close");
    console.log(JSON.stringify({ baseUrl, closeResult, beforeSection, afterSection: afterSection.slice(0, 1800) }, null, 2));
  } finally {
    client.ws.close();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});


