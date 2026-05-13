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
const studentKey = (n) => `multi-r2-student-${pad2(n)}`;
const projectTitle = (n) => `MULTI-PILOT-R2 Wave 2 Project ${pad2(n)}`;

const roleMap = Array.from({ length: 12 }, (_, index) => ({
  projectNo: index + 1,
  studentKey: studentKey(index + 1),
  advisorNo: (index % 11) + 1,
  headNo: ((index + 3) % 11) + 1,
  memberNo: ((index + 7) % 11) + 1
}));

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
  await send("Page.setLifecycleEventsEnabled", { enabled: true }).catch(() => {});

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

async function qaLogin(client, role, key) {
  const roleValue = String(role).toLowerCase();
  await goto(client, `${baseUrl}/qa-login`);
  const action = `
    (() => {
      const form = document.querySelector("form:has(#secret)");
      if (!form) throw new Error("Missing QA login form");
      const role = document.querySelector("#role");
      if (!role) throw new Error("Missing #role");
      const wantedRole = ${literal(roleValue)};
      const roleOption = Array.from(role.options).find((option) => option.value === wantedRole || option.textContent.trim().toLowerCase() === wantedRole);
      if (!roleOption) throw new Error("Role option not found: " + wantedRole + " available=" + Array.from(role.options).map((option) => option.value + ":" + option.textContent.trim()).join("|"));
      role.value = roleOption.value;
      roleOption.selected = true;
      role.dispatchEvent(new Event("input", { bubbles: true }));
      role.dispatchEvent(new Event("change", { bubbles: true }));
      const set = (selector, value) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error("Missing " + selector);
        if (el.tagName === "SELECT") {
          const option = Array.from(el.options).find((item) => item.value === value || item.textContent.includes(value));
          if (!option) throw new Error("Option not found for " + selector + ": " + value);
          el.value = option.value;
          option.selected = true;
        } else {
          el.value = value;
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      if (${literal(roleValue)} === "admin") set("#admin_email", "multi-r2-admin");
      if (${literal(roleValue)} === "student") set("#student_email", ${literal(key)});
      if (${literal(roleValue)} === "teacher") set("#teacher_email", ${literal(key)});
      set("#secret", ${literal(secret)});
      if (role.value !== wantedRole) throw new Error("Role value mismatch before submit: " + role.value + " expected " + wantedRole);
      if (!form.checkValidity()) {
        const invalid = Array.from(form.elements).filter((element) => element.willValidate && !element.checkValidity()).map((element) => element.id || element.name || element.tagName);
        throw new Error("QA login form invalid before submit: " + invalid.join(","));
      }
      form.requestSubmit();
      return { role: role.value, student: document.querySelector("#student_email")?.value, teacher: document.querySelector("#teacher_email")?.value, admin: document.querySelector("#admin_email")?.value };
    })()
  `;
  const submitted = await evaluate(client, action, `qa login ${role} ${key || ""}`);
  await sleep(1800);
  const text = await bodyText(client, `after qa login ${role} ${key || ""}`);
  if (text.includes("Please select an item in the list")) {
    throw new Error(`qa login ${role} ${key || ""}: browser validation blocked submit after selected role ${JSON.stringify(submitted)}`);
  }
}

async function submitStudentProfileAndOrigin(client, item) {
  await qaLogin(client, "STUDENT", item.studentKey);
  await goto(client, `${baseUrl}/student/profile`);
  await bodyText(client, `student ${item.projectNo} profile`);
  const profileSubmitted = await evaluate(client, `
    (() => {
      const form = document.querySelector('form:has(input[name="preferred_name"])');
      if (!form) return "not-actionable";
      const set = (name, value) => {
        const el = form.querySelector('[name="' + name + '"]');
        if (el) {
          el.value = value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      };
      set("preferred_name", "W2 Student ${pad2(item.projectNo)}");
      set("phone", "08000000${pad2(item.projectNo)}");
      set("line_id", "wave2-${pad2(item.projectNo)}");
      form.requestSubmit();
      return "submitted";
    })()
  `, `student ${item.projectNo} profile submit`);
  if (profileSubmitted === "submitted") await sleep(1600);

  await goto(client, `${baseUrl}/student/project`);
  await bodyText(client, `student ${item.projectNo} origin`);
  const origin = await evaluate(client, `
    (() => {
      const form = document.querySelector('form:has(input[name="initial_project_title_th"])');
      if (!form) return "already-submitted-or-not-actionable";
      const submitButton = form.querySelector('button[type="submit"]:not([disabled])');
      if (!submitButton) return "locked-or-already-submitted";
      const set = (name, value) => {
        const el = form.querySelector('[name="' + name + '"]');
        if (!el) throw new Error("Missing field " + name);
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      set("initial_project_title_th", ${literal(projectTitle(item.projectNo))});
      set("initial_project_title_en", ${literal(`Wave 2 Project ${pad2(item.projectNo)}`)});
      set("reason_for_topic", ${literal(`Wave 2 operational pilot reason for project ${pad2(item.projectNo)}.`)});
      set("expected_math_area", "Applied mathematics, modelling, and evidence-based project management.");
      set("consultation_summary", ${literal(`Initial consultation completed for ${projectTitle(item.projectNo)}.`)});
      set("initial_references", ${literal(`Reference set for ${projectTitle(item.projectNo)}.`)});
      set("material_link", ${literal(`https://drive.google.com/file/d/wave2-${pad2(item.projectNo)}/view`)});
      const source = form.querySelector('select[name="source_type"]');
      if (source && source.options.length > 1) {
        source.selectedIndex = 1;
        source.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const advisor = form.querySelector('select[name="tentative_advisor_id"]');
      const option = Array.from(advisor.options).find((item) => item.textContent.includes(${literal(`MULTI-PILOT-R2 Teacher ${pad2(item.advisorNo)}`)}));
      if (!option) throw new Error("Advisor option not found");
      advisor.value = option.value;
      advisor.dispatchEvent(new Event("change", { bubbles: true }));
      const declaration = form.querySelector('input[name="student_declaration"]');
      if (declaration) declaration.checked = true;
      form.requestSubmit(submitButton);
      return "submitted";
    })()
  `, `student ${item.projectNo} origin submit`);
  if (origin === "submitted") await sleep(1800);
  const after = await bodyText(client, `student ${item.projectNo} after origin`);
  if (origin === "submitted" && !after.includes(projectTitle(item.projectNo))) {
    throw new Error(`student ${item.projectNo}: project title missing after origin submit`);
  }
  return { projectNo: item.projectNo, profile: profileSubmitted, origin };
}

async function approveAdvisorRequests(client, teacherNo) {
  await qaLogin(client, "TEACHER", teacherKey(teacherNo));
  const approved = [];
  for (let guard = 0; guard < 10; guard++) {
    await goto(client, `${baseUrl}/teacher/advisor-requests`);
    await bodyText(client, `teacher ${teacherNo} advisor requests`);
    const submitted = await evaluate(client, `
      (() => {
        const cards = Array.from(document.querySelectorAll("section, article, .panel, div"))
          .filter((item) => item.innerText && item.innerText.includes("MULTI-PILOT-R2 Wave 2 Project"));
        const card = cards.find((item) => item.querySelector('form input[name="request_id"]') && item.querySelector('button[name="decision"][value="APPROVE"]'));
        const form = card?.querySelector('form:has(input[name="request_id"])');
        if (!form) return null;
        const label = ((card?.innerText || form.innerText).match(/MULTI-PILOT-R2 Wave 2 Project \\d+/) || ["Wave2 project"])[0];
        form.requestSubmit(form.querySelector('button[name="decision"][value="APPROVE"]'));
        return label;
      })()
    `, `teacher ${teacherNo} approve`);
    if (!submitted) break;
    approved.push(submitted);
    await sleep(1800);
  }
  return { teacherNo, approved };
}

async function confirmAdminProjects(client) {
  await qaLogin(client, "ADMIN");
  const confirmed = [];
  for (let guard = 0; guard < 20; guard++) {
    await goto(client, `${baseUrl}/admin`);
    await bodyText(client, "admin confirmation");
    const submitted = await evaluate(client, `
      (() => {
        const forms = Array.from(document.querySelectorAll('form:has(input[name="project_id"])'));
        const form = forms.find((item) => item.innerText.includes("MULTI-PILOT-R2 Wave 2 Project"));
        if (!form) return null;
        const label = (form.innerText.match(/MULTI-PILOT-R2 Wave 2 Project \\d+/) || ["Wave2 project"])[0];
        form.requestSubmit();
        return label;
      })()
    `, "admin confirm project");
    if (!submitted) break;
    confirmed.push(submitted);
    await sleep(1800);
  }
  return confirmed;
}

async function openProposalRound(client) {
  await qaLogin(client, "ADMIN");
  await goto(client, `${baseUrl}/admin/rounds`);
  await bodyText(client, "admin rounds before proposal open");
  const status = await evaluate(client, `
    (() => {
      const forms = Array.from(document.querySelectorAll('form:has(input[name="round_type"][value="PROPOSAL"])'));
      const form = forms.find((item) => !item.querySelector("button[disabled]"));
      if (!form) return "already-open-or-not-actionable";
      form.requestSubmit();
      return "opened";
    })()
  `, "open proposal round");
  if (status === "opened") await sleep(1800);
  await goto(client, `${baseUrl}/admin/rounds`);
  await bodyText(client, "admin rounds after proposal open");
  return status;
}

async function submitProposal(client, item) {
  await qaLogin(client, "STUDENT", item.studentKey);
  await goto(client, `${baseUrl}/student/proposal`);
  await bodyText(client, `student ${item.projectNo} proposal before submit`);
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
      const title = ${literal(projectTitle(item.projectNo))};
      set("project_title_th", title);
      set("project_title_en", ${literal(`Wave 2 Proposal ${pad2(item.projectNo)}`)});
      set("abstract_of_talk", "Abstract for " + title + ". This Wave 2 evidence checks proposal flow at multi-project scale.");
      set("motivation_background", "Background and motivation for " + title + ".");
      set("objectives", "Objective 1: verify lifecycle. Objective 2: verify workload semantics.");
      set("proposed_methods", "Use mathematical modelling and controlled operational testing for " + title + ".");
      set("expected_outcomes", "Expected outcome: complete evidence trail for " + title + ".");
      const activity = document.querySelector("#timeline_activity_0");
      if (activity) {
        activity.value = "Prepare proposal evidence for " + title;
        activity.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const deliverable = document.querySelector("#timeline_deliverable_0");
      if (deliverable) {
        deliverable.value = "Proposal evidence for " + title;
        deliverable.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const timelineMarkdown = [
        "| ลำดับ | งาน | ช่วงสัปดาห์ | ผลลัพธ์/หลักฐานที่คาดว่าจะได้ |",
        "|---:|---|---:|---|",
        "| 1 | Prepare proposal evidence for " + title + " | สัปดาห์ 1-4 | Proposal evidence for " + title + " |"
      ].join("\\n");
      const timelineItems = JSON.stringify([
        {
          activity: "Prepare proposal evidence for " + title,
          startWeek: "1",
          endWeek: "4",
          deliverable: "Proposal evidence for " + title,
          duration: 4
        }
      ]);
      set("timeline", timelineMarkdown);
      set("timeline_items_json", timelineItems);
      set("questions_for_teachers", "No blocking question for " + title + ".");
      set("material_link", ${literal(`https://drive.google.com/file/d/wave2-proposal-${pad2(item.projectNo)}/view`)});
      const declaration = form.querySelector('input[name="student_declaration"]');
      if (declaration) declaration.checked = true;
      form.requestSubmit(submitButton);
      return "submitted";
    })()
  `, `student ${item.projectNo} proposal submit`);
  if (status === "submitted") await sleep(2200);
  const after = await bodyText(client, `student ${item.projectNo} after proposal`);
  if (status === "submitted" && !after.includes(projectTitle(item.projectNo))) {
    throw new Error(`student ${item.projectNo}: proposal title missing after submit`);
  }
  return { projectNo: item.projectNo, proposal: status };
}

async function main() {
  const client = await connectPage();
  const result = {
    baseUrl,
    studentOrigin: [],
    advisorApprovals: [],
    adminConfirmed: [],
    proposalRound: null,
    proposalSubmissions: []
  };

  for (const item of roleMap) {
    result.studentOrigin.push(await submitStudentProfileAndOrigin(client, item));
  }

  for (let teacherNo = 1; teacherNo <= 11; teacherNo++) {
    result.advisorApprovals.push(await approveAdvisorRequests(client, teacherNo));
  }

  result.adminConfirmed = await confirmAdminProjects(client);
  result.proposalRound = await openProposalRound(client);

  for (const item of roleMap) {
    if (item.projectNo === 9) {
      result.proposalSubmissions.push({ projectNo: item.projectNo, proposal: "withheld-for-late-recovery" });
      continue;
    }
    result.proposalSubmissions.push(await submitProposal(client, item));
  }

  await qaLogin(client, "ADMIN");
  await goto(client, `${baseUrl}/admin/rounds`);
  result.adminRoundsTextSample = (await bodyText(client, "admin rounds after proposal submissions")).slice(0, 1500);
  console.log(JSON.stringify(result, null, 2));
  client.ws.close();
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
