import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const CDP = "http://127.0.0.1:9222";
const QA_URL =
  process.env.QA_PREVIEW_URL ||
  "https://system-project-math-sci-8nu3416ka-lordtd-hubs-projects.vercel.app";
const QA_SECRET = process.env.QA_LOGIN_SECRET;

if (!QA_SECRET) {
  throw new Error("QA_LOGIN_SECRET is required in the environment.");
}

async function getTarget() {
  const targets = await fetch(`${CDP}/json/list`).then((response) => response.json());
  const page =
    targets.find((target) => target.type === "page" && target.url.includes("system-project-math-sci")) ||
    targets.find((target) => target.type === "page");
  if (!page) throw new Error("No page target found.");
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
    ws.onopen = () => {
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
    };
  });
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}

async function waitFor(client, predicateExpression, label, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await evaluate(client, predicateExpression).catch(() => false);
    if (ok) return;
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function navigate(client, url) {
  await client.send("Page.navigate", { url });
  await waitFor(client, "document.readyState !== 'loading'", `navigation ${url}`, 30000);
  await delay(1000);
}

async function login(client, role, identityValue) {
  await navigate(client, `${QA_URL}/qa-login`);
  await waitFor(client, "!!document.querySelector('#role')", "QA login form");
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
      setSelect('#role', ${JSON.stringify(role)});
      const identitySelector = ${JSON.stringify(
        role === "student" ? "#student_email" : role === "teacher" ? "#teacher_email" : "#admin_email",
      )};
      setSelect(identitySelector, ${JSON.stringify(identityValue)});
      const secret = document.querySelector('#secret');
      if (!secret) throw new Error('Missing secret');
      secret.value = ${JSON.stringify(QA_SECRET)};
      secret.dispatchEvent(new Event('input', { bubbles: true }));
      secret.closest('form').requestSubmit();
      return true;
    })()`,
  );
  await waitFor(client, `location.pathname.startsWith('/${role}')`, `${role} dashboard`, 30000);
  await delay(1000);
}

async function captureViewport(client, outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await evaluate(
    client,
    `(() => {
      window.scrollTo(0, 0);
      document.querySelectorAll('[data-nextjs-toast], nextjs-portal').forEach((el) => el.remove());
      return true;
    })()`,
  );
  await delay(500);
  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(outputPath, Buffer.from(screenshot.data, "base64"));
}

async function captureRoute(client, route, outputPath) {
  await navigate(client, `${QA_URL}${route}`);
  const state = await evaluate(
    client,
    `(() => ({
      url: location.href,
      title: document.title,
      h1: document.querySelector('h1')?.innerText || '',
      bodyStart: document.body.innerText.slice(0, 500),
    }))()`,
  );
  if (/เลือกบัญชีทดสอบ/.test(state.bodyStart)) {
    throw new Error(`Unexpected QA login while capturing ${route}`);
  }
  await captureViewport(client, outputPath);
  console.log(JSON.stringify({ route, outputPath, h1: state.h1 }, null, 2));
}

async function main() {
  const target = await getTarget();
  const client = await connect(target.webSocketDebuggerUrl);
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 950,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const studentDir = path.resolve("public/manual/screenshots/student");
  const teacherDir = path.resolve("public/manual/screenshots/teacher");

  await login(client, "student", "manual-demo-student-01");
  await captureRoute(client, "/student", path.join(studentDir, "student-01-dashboard.png"));
  await captureRoute(client, "/student/proposal", path.join(studentDir, "student-02-project-form.png"));
  await captureRoute(client, "/student/proposal", path.join(studentDir, "student-03-advisor-request.png"));
  await captureRoute(client, "/student/proposal", path.join(studentDir, "student-04-proposal-submit.png"));
  await captureRoute(client, "/student/schedule", path.join(studentDir, "student-05-schedule-submit.png"));
  await captureRoute(client, "/student/schedule", path.join(studentDir, "student-08-progress1-submit.png"));
  await captureRoute(client, "/student/feedback", path.join(studentDir, "student-09-progress-feedback.png"));
  await captureRoute(client, "/student/schedule", path.join(studentDir, "student-10-final-submit.png"));
  await captureRoute(client, "/student/report", path.join(studentDir, "student-11-report-submit-v1.png"));
  await captureRoute(client, "/student", path.join(studentDir, "student-14-completed-or-project-record.png"));

  await login(client, "student", "manual-demo-student-02");
  await captureRoute(client, "/student/report", path.join(studentDir, "student-12-report-revision-comment.png"));
  await captureRoute(client, "/student/report", path.join(studentDir, "student-13-report-submit-v2.png"));

  await login(client, "student", "manual-demo-student-03");
  await captureRoute(client, "/student/schedule", path.join(studentDir, "student-06-schedule-rejected.png"));
  await captureRoute(client, "/student/schedule", path.join(studentDir, "student-07-schedule-resubmit.png"));

  await login(client, "teacher", "manual-demo-teacher-07");
  await captureRoute(client, "/teacher", path.join(teacherDir, "teacher-01-dashboard.png"));
  await captureRoute(client, "/teacher/advisor-requests", path.join(teacherDir, "teacher-02-advisor-request.png"));
  await captureRoute(client, "/teacher/advicees", path.join(teacherDir, "teacher-03-advicees.png"));
  await captureRoute(client, "/teacher/schedules", path.join(teacherDir, "teacher-04-schedule-review.png"));
  await captureRoute(client, "/teacher/schedules", path.join(teacherDir, "teacher-05-schedule-reject.png"));
  await captureRoute(client, "/teacher/schedules", path.join(teacherDir, "teacher-06-schedule-approve-resubmitted.png"));
  await captureRoute(client, "/teacher/proposals", path.join(teacherDir, "teacher-07-proposal-scoring.png"));
  await captureRoute(client, "/teacher/progress1", path.join(teacherDir, "teacher-08-progress-scoring.png"));
  await captureRoute(client, "/teacher/final", path.join(teacherDir, "teacher-09-final-scoring.png"));
  await captureRoute(client, "/teacher/reports", path.join(teacherDir, "teacher-10-report-review.png"));
  await captureRoute(client, "/teacher/reports", path.join(teacherDir, "teacher-11-report-request-revision.png"));
  await captureRoute(client, "/teacher/reports", path.join(teacherDir, "teacher-12-report-approve-latest.png"));
  await captureRoute(client, "/teacher/advisor-score", path.join(teacherDir, "teacher-13-advisor-score.png"));
  await captureRoute(client, "/teacher/advicees", path.join(teacherDir, "teacher-14-project-record.png"));

  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
