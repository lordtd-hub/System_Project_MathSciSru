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
const teacherKey = (n) => `multi-r2-teacher-${pad2(n)}`;

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
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
    }).on("error", reject);
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

async function bodyText(client, label) {
  const text = await evaluate(client, "document.body ? document.body.innerText : ''", label);
  if (!text || text.trim().length < 120) throw new Error(`${label}: shell-only or blank body`);
  if (/Application error|NEXT_REDIRECT|digest/i.test(text)) throw new Error(`${label}: error/digest page`);
  return text;
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
      if (${JSON.stringify(roleValue)} === "teacher") setSelect("#teacher_email", ${JSON.stringify(key)});
      if (${JSON.stringify(roleValue)} === "admin") setSelect("#admin_email", "multi-r2-admin");
      document.querySelector("#secret").value = ${JSON.stringify(secret)};
      document.querySelector("#secret").dispatchEvent(new Event("input", { bubbles: true }));
      if (!form.checkValidity()) throw new Error("invalid login form");
      form.requestSubmit();
      return true;
    })()
  `, `qa login ${role} ${key || ""}`);
  await sleep(1600);
  await bodyText(client, `after qa login ${role} ${key || ""}`);
}

async function nextWave2ScoringLink(client) {
  await goto(client, `${baseUrl}/teacher/proposals`);
  await bodyText(client, "teacher proposals");
  return evaluate(client, `
    (() => {
      const links = Array.from(document.querySelectorAll('a[href*="/teacher/scoring/"]'));
      const link = links.find((item) => {
        let node = item;
        let text = item.innerText || "";
        for (let depth = 0; depth < 6 && node; depth += 1, node = node.parentElement) {
          text += "\\n" + (node.innerText || "");
          if (text.includes("MULTI-PILOT-R2 Wave 2 Project")) break;
        }
        return text.includes("MULTI-PILOT-R2 Wave 2 Project") && !/ดูผล|ส่งแล้ว|ประเมินแล้ว/.test(item.innerText);
      });
      return link ? new URL(link.getAttribute("href"), location.origin).href : null;
    })()
  `, "find wave2 scoring link");
}

async function submitScore(client, link, teacherNo) {
  await goto(client, link);
  await bodyText(client, `teacher ${teacherNo} scoring`);
  const result = await evaluate(client, `
    (() => {
      const form = document.querySelector('form:has(input[name="assignment_id"])');
      if (!form) return { status: "not-actionable" };
      const title = document.body.innerText.match(/MULTI-PILOT-R2 Wave 2 Project \\d+/)?.[0] || "Wave2 proposal";
      for (const select of form.querySelectorAll('select[name^="condition_count:"]')) {
        select.selectedIndex = Math.max(0, select.options.length - 1);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      for (const checkbox of form.querySelectorAll('input[name="checked_item"]')) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const decision = form.querySelector('select[name="decision"]');
      if (decision) {
        decision.value = "PASS";
        decision.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const reason = form.querySelector('[name="reason"]');
      if (reason) {
        reason.value = "";
        reason.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const comment = form.querySelector('[name="overall_comment"]');
      if (comment) {
        comment.value = "Wave 2 proposal evidence is sufficient for controlled pilot progression.";
        comment.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const submit = form.querySelector('button[name="submit_mode"][value="submit"]:not([disabled])');
      if (!submit) return { status: "locked", title };
      form.requestSubmit(submit);
      return { status: "submitted", title };
    })()
  `, `submit proposal score teacher ${teacherNo}`);
  if (result.status === "submitted") await sleep(1800);
  await bodyText(client, `teacher ${teacherNo} after score submit`);
  return result;
}

async function main() {
  const client = await connectPage();
  const result = { baseUrl, teachers: [] };
  for (let teacherNo = 1; teacherNo <= 11; teacherNo++) {
    await qaLogin(client, "teacher", teacherKey(teacherNo));
    const scored = [];
    for (let guard = 0; guard < 20; guard++) {
      const link = await nextWave2ScoringLink(client);
      if (!link) break;
      const submission = await submitScore(client, link, teacherNo);
      scored.push(submission);
      if (submission.status !== "submitted") break;
    }
    result.teachers.push({ teacherNo, scored });
  }
  console.log(JSON.stringify(result, null, 2));
  client.ws.close();
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
