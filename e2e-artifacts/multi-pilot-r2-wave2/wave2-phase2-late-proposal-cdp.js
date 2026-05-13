const http = require("node:http");

const baseUrl = process.env.QA_PREVIEW_URL || "https://system-project-math-sci-daaspquy0-lordtd-hubs-projects.vercel.app";
const secret = process.env.QA_LIVE_SECRET;
const cdpUrl = process.env.EDGE_CDP_URL || "http://127.0.0.1:9333";
const qaHost = new URL(baseUrl).host;

if (!secret) {
  console.error("QA_LIVE_SECRET is required");
  process.exit(2);
}

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
    if (message.method === "Page.javascriptDialogOpening") {
      send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
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
        const option = Array.from(el.options).find((item) => item.value === value || item.textContent.includes(value));
        if (!option) throw new Error("Missing option " + value + " for " + selector);
        el.value = option.value;
        option.selected = true;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      setSelect("#role", ${JSON.stringify(roleValue)});
      if (${JSON.stringify(roleValue)} === "admin") setSelect("#admin_email", "multi-r2-admin");
      if (${JSON.stringify(roleValue)} === "student") setSelect("#student_email", ${JSON.stringify(key)});
      document.querySelector("#secret").value = ${JSON.stringify(secret)};
      document.querySelector("#secret").dispatchEvent(new Event("input", { bubbles: true }));
      if (!form.checkValidity()) throw new Error("invalid login form");
      form.requestSubmit();
    })()
  `, `qa login ${role} ${key || ""}`);
  await sleep(1600);
  await bodyText(client, `after qa login ${role} ${key || ""}`);
}

async function openLateException(client) {
  await qaLogin(client, "admin");
  await goto(client, `${baseUrl}/admin/round-exceptions?round_type=PROPOSAL&q=R2STU09`);
  await bodyText(client, "round exceptions W2-09");
  const result = await evaluate(client, `
    (() => {
      const forms = Array.from(document.querySelectorAll('form:has(input[name="project_id"])'));
      const form = forms.find((item) => {
        let node = item;
        let text = item.innerText || "";
        for (let depth = 0; depth < 8 && node; depth += 1, node = node.parentElement) text += "\\n" + (node.innerText || "");
        return text.includes("R2STU09") || text.includes("MULTI-PILOT-R2 Wave 2 Project 09");
      });
      if (!form) return "not-found";
      const reason = form.querySelector('[name="reason"]');
      if (reason) {
        reason.value = "Wave 2 planned late Proposal recovery for Project 09.";
        reason.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const submit = form.querySelector('button[type="submit"]:not([disabled])');
      if (!submit) return "not-actionable";
      form.requestSubmit(submit);
      return "submitted";
    })()
  `, "open late exception");
  if (result === "submitted") await sleep(1800);
  await goto(client, `${baseUrl}/admin/round-exceptions?round_type=PROPOSAL&q=R2STU09`);
  const sample = await bodyText(client, "round exceptions after open");
  return { result, sample: sample.slice(0, 1200) };
}

async function submitStudent09Proposal(client) {
  await qaLogin(client, "student", "multi-r2-student-09");
  await goto(client, `${baseUrl}/student/proposal`);
  await bodyText(client, "student09 late proposal before");
  const status = await evaluate(client, `
    (() => {
      const form = document.querySelector('form:has(input[name="project_title_th"])');
      if (!form) return "not-actionable";
      const submitButton = form.querySelector('button[type="submit"]:not([disabled])');
      if (!submitButton) return "locked-or-already-submitted";
      const set = (name, value) => {
        const el = form.querySelector('[name="' + name + '"]');
        if (!el) throw new Error("Missing field " + name);
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const title = "MULTI-PILOT-R2 Wave 2 Project 09";
      set("project_title_th", title);
      set("project_title_en", "Wave 2 Proposal 09");
      set("abstract_of_talk", "Late Proposal recovery abstract for " + title + ".");
      set("motivation_background", "Late recovery background for " + title + ".");
      set("objectives", "Objective: verify late proposal recovery remains auditable.");
      set("proposed_methods", "Submit late proposal under admin-opened exception and verify penalty audit.");
      set("expected_outcomes", "Late proposal is submitted, scored, and tagged for audit.");
      const activity = document.querySelector("#timeline_activity_0");
      if (activity) {
        activity.value = "Late proposal recovery evidence";
        activity.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const deliverable = document.querySelector("#timeline_deliverable_0");
      if (deliverable) {
        deliverable.value = "Auditable late proposal evidence";
        deliverable.dispatchEvent(new Event("input", { bubbles: true }));
      }
      set("timeline", "| ลำดับ | งาน | ช่วงสัปดาห์ | ผลลัพธ์/หลักฐานที่คาดว่าจะได้ |\\n|---:|---|---:|---|\\n| 1 | Late proposal recovery evidence | สัปดาห์ 1-4 | Auditable late proposal evidence |");
      set("timeline_items_json", JSON.stringify([{ activity: "Late proposal recovery evidence", startWeek: "1", endWeek: "4", deliverable: "Auditable late proposal evidence", duration: 4 }]));
      set("questions_for_teachers", "Late recovery case for Wave 2.");
      set("material_link", "https://drive.google.com/file/d/wave2-proposal-09-late/view");
      const declaration = form.querySelector('input[name="student_declaration"]');
      if (declaration) declaration.checked = true;
      if (!form.checkValidity()) {
        const invalid = Array.from(form.elements).filter((element) => element.willValidate && !element.checkValidity()).map((element) => element.id || element.name || element.tagName);
        throw new Error("late proposal form invalid before submit: " + invalid.join(","));
      }
      form.requestSubmit(submitButton);
      return "submitted";
    })()
  `, "student09 submit late proposal");
  if (status === "submitted") await sleep(2200);
  const sample = await bodyText(client, "student09 late proposal after");
  return { status, sample: sample.slice(0, 1200) };
}

async function main() {
  const client = await connectPage();
  const lateException = await openLateException(client);
  const proposal = await submitStudent09Proposal(client);
  console.log(JSON.stringify({ baseUrl, lateException, proposal }, null, 2));
  client.ws.close();
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
