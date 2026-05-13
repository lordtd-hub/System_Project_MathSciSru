async (page) => {
  const BASE_URL = "__QA_BASE_URL__";
  const QA_SECRET = "__QA_SECRET__";
  if (!QA_SECRET || QA_SECRET.startsWith("__")) throw new Error("QA secret placeholder was not replaced. Do not hard-code the QA secret in the template.");

  const SCREENSHOT_DIR = "e2e-artifacts/multi-pilot-r2-wave1/screenshots";

  const log = [];
  const bugs = [];
  const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

  async function writeStep(name, data = {}) {
    const entry = { at: new Date().toISOString(), name, ...data };
    log.push(entry);
    console.log(JSON.stringify(entry));
  }

  page.on("dialog", async (dialog) => {
    await writeStep("DIALOG_AUTO_ACCEPT", { message: dialog.message() });
    await dialog.accept();
  });

  async function screenshot(name) {
    const file = `${SCREENSHOT_DIR}/${stamp()}-${name}.png`;
    await page.screenshot({ path: file, fullPage: true });
    return file;
  }

  async function bodyText() {
    return await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  }

  async function bug(data) {
    const shot = await screenshot(`bug-${data.severity}-${data.slug}`);
    const item = { ...data, url: page.url(), screenshot: shot };
    bugs.push(item);
    await writeStep("BUG", item);
  }

  async function assertNoAppError(context) {
    const text = await bodyText();
    if (/Application error|server-side exception|Digest:/i.test(text)) {
      await bug({
        severity: "Blocker",
        slug: `app-error-${context}`,
        role: "unknown",
        project: "unknown",
        route: page.url(),
        expected: "Page renders without application error.",
        actual: text.slice(0, 600),
        suggestedFix: "Inspect server action/page error digest for this route."
      });
      throw new Error(`Application error at ${context}`);
    }
  }

  async function assertStudentScheduleNotShellOnly(context) {
    await assertNoAppError(context);
    const state = await page.evaluate(() => {
      const routeOk = location.pathname === "/student/schedule";
      const contentRoot = document.querySelector('[data-testid="student-schedule-page-content"]');
      const statusCards = document.querySelector('[data-testid="student-schedule-round-status-cards"]');
      const evidenceSummary = document.querySelector('[data-testid="student-schedule-evidence-summary"]');
      const latestProposals = document.querySelector('[data-testid="student-schedule-latest-proposals"]');
      const scheduleForm = document.querySelector('[data-testid="student-schedule-proposal-form-wrapper"]');
      const digestText = /Application error|server-side exception|Digest:/i.test(document.body.innerText);
      return {
        routeOk,
        hasContentRoot: Boolean(contentRoot),
        hasStatusCards: Boolean(statusCards),
        hasEvidenceSummary: Boolean(evidenceSummary),
        hasLatestProposals: Boolean(latestProposals),
        hasScheduleForm: Boolean(scheduleForm),
        digestText,
        bodySnippet: document.body.innerText.slice(0, 1000)
      };
    });
    const hasRequiredContent = state.routeOk && state.hasContentRoot && state.hasStatusCards && state.hasEvidenceSummary && state.hasLatestProposals && !state.digestText;
    if (!hasRequiredContent) {
      await bug({
        severity: "Major",
        slug: `student-schedule-shell-only-${context}`,
        role: "Student",
        project: "guarded schedule flow",
        route: "/student/schedule",
        expected: "Schedule page renders content root, status cards, evidence summary, and latest proposal section after navigation or evidence save.",
        actual: JSON.stringify(state),
        suggestedFix: "Ensure /student/schedule?success=assessment_evidence_saved keeps rendering the normal page content and schedule proposal action."
      });
      throw new Error(`Student schedule page rendered shell-only or missing guarded content at ${context}`);
    }
    await writeStep("STUDENT_SCHEDULE_CONTENT_GUARD", { context, ...state });
    return state;
  }

  async function goto(route, context) {
    const url = route.startsWith("http") ? route : `${BASE_URL}${route}`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await assertNoAppError(context);
  }

  async function selectByValueOrText(selector, target) {
    const select = page.locator(selector).first();
    const options = await select.locator("option").evaluateAll((nodes) =>
      nodes.map((node) => ({ value: node.value, text: node.textContent || "" }))
    );
    const option = options.find((item) => item.value === target || item.text.includes(target));
    if (!option) throw new Error(`No option matching ${target} in ${selector}`);
    await select.selectOption(option.value);
  }

  async function login(role, identityKey) {
    await goto("/qa-login", `qa-login-${role}-${identityKey}`);
    const qaLogout = page.locator("button").filter({ hasText: "ออกจาก QA session" }).first();
    if (await qaLogout.count()) {
      await qaLogout.click();
      await page.waitForLoadState("networkidle").catch(() => {});
      await goto("/qa-login", `qa-login-after-logout-${role}-${identityKey}`);
    }
    await selectByValueOrText("#role", role);
    if (role === "student") await selectByValueOrText("#student_email", identityKey);
    if (role === "teacher") await selectByValueOrText("#teacher_email", identityKey);
    if (role === "admin") await selectByValueOrText("#admin_email", identityKey);
    await page.locator('input[name="secret"], input[type="password"]').first().fill(QA_SECRET);
    await page.locator("form:has(#role)").first().locator('button[type="submit"]').last().click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await assertNoAppError(`after-login-${role}-${identityKey}`);
    await writeStep("LOGIN", { role, identityKey, url: page.url() });
  }

  async function progress2State() {
    await goto("/student/schedule", "student-schedule-progress2-state");
    await assertStudentScheduleNotShellOnly("student-schedule-progress2-state");
    return await page.evaluate(() => {
      const option = document.querySelector('select[name="round_type"] option[value="PROGRESS_2"]');
      const form = document.querySelector('form select[name="round_type"]')?.closest("form");
      const submit = form?.querySelector('button[type="submit"], button:not([type])');
      return {
        hasProgress2EvidenceForm: Boolean(document.querySelector('input[name="assessment_kind"][value="PROGRESS_2"]')),
        hasProgress2ScheduleOption: Boolean(option),
        progress2ScheduleOptionDisabled: option ? option.disabled : null,
        scheduleSubmitDisabled: submit ? submit.disabled : null,
        bodySnippet: document.body.innerText.slice(0, 1000)
      };
    });
  }

  async function openProgress2RoundIfPossible() {
    await login("admin", "multi-r2-admin");
    await goto("/admin/rounds", "admin-rounds-open-progress2");
    const beforeShot = await screenshot("admin-rounds-before-progress2-open");
    const state = await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll("form"));
      for (let index = 0; index < forms.length; index += 1) {
        const form = forms[index];
        if (!form.querySelector('input[name="round_type"][value="PROGRESS_2"]')) continue;
        const button = Array.from(form.querySelectorAll("button")).find((candidate) =>
          candidate.innerText.includes("เปิดรอบ") || candidate.innerText.includes("Open")
        );
        if (!button) continue;
        return { found: true, index, disabled: button.disabled, text: button.innerText };
      }
      return { found: false };
    });
    state.beforeShot = beforeShot;
    await writeStep("PROGRESS2_OPEN_BUTTON_STATE", state);
    if (!state.found || state.disabled) return state;
    await page.locator("form").nth(state.index).locator("button").last().click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await assertNoAppError("after-open-progress2");
    const afterShot = await screenshot("admin-rounds-after-progress2-open");
    await writeStep("PROGRESS2_OPENED", { afterShot });
    return { ...state, clicked: true, afterShot };
  }

  async function openLateProposalStudent02() {
    await login("admin", "multi-r2-admin");
    await goto("/admin/rounds", "admin-rounds-late-proposal");
    const panelShot = await screenshot("admin-rounds-late-proposal-panel");
    const formIndex = await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll("form"));
      return forms.findIndex((form) =>
        form.querySelector('input[name="round_type"][value="PROPOSAL"]') &&
        /R2STU02|Student 02|Project 02/.test(form.innerText)
      );
    });
    if (formIndex < 0) {
      await writeStep("LATE_PROPOSAL_FORM_NOT_FOUND", { panelShot });
      return { status: "not-found", panelShot };
    }
    const form = page.locator("form").nth(formIndex);
    const disabled = await form.locator("button").last().isDisabled().catch(() => true);
    if (disabled) {
      await writeStep("LATE_PROPOSAL_FORM_DISABLED", { panelShot });
      return { status: "disabled-or-already-open", panelShot };
    }
    await form.locator("button").last().click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await assertNoAppError("after-open-late-proposal-student02");
    const shot = await screenshot("admin-opened-late-proposal-student02");
    await writeStep("LATE_PROPOSAL_OPENED", { shot });
    return { status: "opened", shot };
  }

  async function submitStudent02Proposal() {
    await login("student", "multi-r2-student-02");
    await goto("/student/proposal", "student02-proposal-submit");
    const beforeShot = await screenshot("student02-proposal-submit-before");
    const submitButton = page.locator('button[type="submit"], form button').filter({ hasText: /ส่ง|Proposal|เสนอหัวข้อ/ }).last();
    const disabled = await submitButton.isDisabled().catch(() => true);
    if (disabled) {
      await writeStep("STUDENT02_PROPOSAL_STILL_DISABLED", { beforeShot });
      return { status: "disabled", beforeShot };
    }
    const fill = async (selector, value) => {
      const target = page.locator(selector).first();
      if (await target.count()) await target.fill(value);
    };
    await fill('input[name="project_title_th"]', "MULTI-PILOT-R2 Project 02 Late Proposal Recovery");
    await fill('input[name="project_title_en"]', "MULTI-PILOT-R2 Project 02 Late Proposal Recovery");
    await fill('textarea[name="abstract_of_talk"]', "Late proposal recovery test for MULTI-PILOT-R2 Project 02.");
    await fill('textarea[name="motivation_background"]', "ทดสอบการเปิดส่ง Proposal ย้อนหลังรายกรณีหลังปิดรอบ");
    await fill('textarea[name="objectives"]', "1. ตรวจสอบ late lock\n2. ตรวจสอบ admin reopen\n3. ตรวจสอบ reviewer queue");
    await fill('textarea[name="proposed_methods"]', "ดำเนินการผ่านหน้าเว็บจริงโดยไม่ใช้ direct database update");
    await fill('textarea[name="expected_outcomes"]', "ระบบควรบันทึก Proposal ได้หลัง Admin เปิดสิทธิ์รายกรณี และส่งต่อคิวกรรมการได้");
    await fill('textarea[name="questions_for_teachers"]', "กรุณาตรวจว่าหลักฐาน late override แสดงครบหรือไม่");
    await fill('input[name="material_link"]', "https://drive.google.com/drive/folders/multi-pilot-r2-late-proposal-02");
    await fill("#timeline_activity_0", "Late Proposal recovery test Project 02");
    await fill("#timeline_deliverable_0", "Proposal document and late override evidence");
    if (await page.locator("#timeline_start_0").count()) await page.locator("#timeline_start_0").selectOption("1").catch(() => {});
    if (await page.locator("#timeline_end_0").count()) await page.locator("#timeline_end_0").selectOption("4").catch(() => {});
    if (await page.locator('input[name="student_declaration"]').count()) await page.locator('input[name="student_declaration"]').check();
    await submitButton.click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await assertNoAppError("after-student02-proposal-submit");
    const afterShot = await screenshot("student02-proposal-after-submit");
    await writeStep("STUDENT02_PROPOSAL_SUBMIT_RESULT", { beforeShot, afterShot, url: page.url() });
    return { status: "submitted", beforeShot, afterShot };
  }

  async function teacherProposalVisibility() {
    const results = [];
    for (const key of ["multi-r2-teacher-01", "multi-r2-teacher-02", "multi-r2-teacher-03", "multi-r2-teacher-04"]) {
      await login("teacher", key);
      await goto("/teacher/proposals", `teacher-proposals-${key}`);
      const text = await bodyText();
      const visible = /Project 02|Student 02|R2STU02/.test(text);
      const shot = await screenshot(`teacher-${key}-student02-proposal-visibility`);
      const result = { key, visible, shot, snippet: text.slice(0, 600) };
      results.push(result);
      await writeStep("TEACHER_STUDENT02_PROPOSAL_VISIBILITY", result);
    }
    return results;
  }

  async function teacherDeltaIsolation() {
    await login("teacher", "teacher-delta");
    await goto("/teacher", "teacher-delta-dashboard");
    const dashboardShot = await screenshot("teacher-delta-dashboard");
    await goto("/teacher/proposals", "teacher-delta-proposals");
    const text = await bodyText();
    const proposalsShot = await screenshot("teacher-delta-proposals");
    const hasAction = /ประเมินการเสนอหัวข้อ|ส่งคะแนน|พร้อมให้คะแนน/i.test(text);
    const result = { hasAction, dashboardShot, proposalsShot, snippet: text.slice(0, 600) };
    await writeStep("TEACHER_DELTA_ISOLATION", result);
    if (hasAction) {
      await bug({
        severity: "Major",
        slug: "teacher-delta-unexpected-proposal-action",
        role: "Teacher Delta",
        project: "N/A",
        route: "/teacher/proposals",
        expected: "Non-committee Teacher Delta should not see scoring actions.",
        actual: text.slice(0, 600),
        suggestedFix: "Filter proposal scoring list to assigned evaluator/committee roles."
      });
    }
    return result;
  }

  await writeStep("RUN_START", { baseUrl: BASE_URL });

  await login("student", "multi-r2-student-01");
  await goto("/student", "student01-dashboard-before-progress2-open");
  const beforeDashboardShot = await screenshot("student01-dashboard-before-progress2-open");
  const beforeState = await progress2State();
  await screenshot("student01-schedule-before-progress2-open");
  await writeStep("PROGRESS2_STATE_BEFORE_ADMIN_OPEN", { beforeDashboardShot, ...beforeState });
  if (beforeState.hasProgress2EvidenceForm || beforeState.progress2ScheduleOptionDisabled === false) {
    await bug({
      severity: "Major",
      slug: "progress2-action-before-admin-open",
      role: "Student 01",
      project: "Project 01",
      route: "/student/schedule",
      expected: "Progress 2 should not be actionable before Admin opens Progress 2 round.",
      actual: JSON.stringify(beforeState),
      suggestedFix: "Keep schedule/evidence visibility tied to course-level round open state."
    });
  }

  const openProgress2 = await openProgress2RoundIfPossible();
  await login("student", "multi-r2-student-01");
  const afterState = await progress2State();
  const afterProgress2Shot = await screenshot("student01-schedule-after-progress2-open");
  await writeStep("PROGRESS2_STATE_AFTER_ADMIN_OPEN", { openProgress2, afterProgress2Shot, ...afterState });

  await login("student", "multi-r2-student-02");
  await goto("/student", "student02-dashboard-late-state");
  const student02DashboardShot = await screenshot("student02-dashboard-late-state");
  await goto("/student/proposal", "student02-proposal-late-state");
  const student02ProposalShot = await screenshot("student02-proposal-late-state");
  const student02Late = await page.evaluate(() => ({
    enabledSubmitTexts: Array.from(document.querySelectorAll("button[type='submit'], form button")).filter((button) => !button.disabled).map((button) => button.innerText),
    bodySnippet: document.body.innerText.slice(0, 1000)
  }));
  await writeStep("STUDENT02_LATE_STATE", { student02DashboardShot, student02ProposalShot, ...student02Late });

  const lateOpen = await openLateProposalStudent02();
  const submitStudent02 = await submitStudent02Proposal();
  const visibility = await teacherProposalVisibility();
  const delta = await teacherDeltaIsolation();

  await writeStep("RUN_COMPLETE", {
    bugCount: bugs.length,
    openProgress2,
    lateOpen,
    submitStudent02,
    visibility,
    delta
  });

  return { bugCount: bugs.length, logCount: log.length, bugs };
}
