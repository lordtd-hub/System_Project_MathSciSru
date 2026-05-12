async (page) => {
  const BASE_URL = "__QA_BASE_URL__";
  const QA_SECRET = "__QA_SECRET__";
  if (!QA_SECRET || QA_SECRET.startsWith("__")) throw new Error("QA secret placeholder was not replaced.");

  const SCREENSHOT_DIR = "e2e-artifacts/multi-pilot-r2-wave1/screenshots";
  const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
  const steps = [];
  const bugs = [];

  async function step(name, data = {}) {
    const entry = { at: new Date().toISOString(), name, ...data };
    steps.push(entry);
    console.log(JSON.stringify(entry));
  }

  page.on("dialog", async (dialog) => {
    await step("DIALOG_AUTO_ACCEPT", { message: dialog.message() });
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
    await step("BUG", item);
  }

  async function goto(route, context) {
    const url = route.startsWith("http") ? route : `${BASE_URL}${route}`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    const text = await bodyText();
    if (/Application error|server-side exception|Digest:/i.test(text)) {
      await bug({
        severity: "Blocker",
        slug: `app-error-${context}`,
        role: "unknown",
        project: "unknown",
        route: page.url(),
        expected: "Page renders without application error.",
        actual: text.slice(0, 700),
        suggestedFix: "Inspect server action/page error digest."
      });
      throw new Error(`Application error at ${context}`);
    }
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

  function expectedPathFor(role) {
    if (role === "student") return "/student";
    if (role === "teacher") return "/teacher";
    if (role === "admin") return "/admin";
    throw new Error(`Unknown role: ${role}`);
  }

  function expectedIdentityText(role, identityKey) {
    if (role === "student" && identityKey === "multi-r2-student-02") return "MULTI-PILOT-R2 Student 02";
    if (role === "teacher") {
      const match = identityKey.match(/multi-r2-teacher-(\d+)/);
      if (match) return `MULTI-PILOT-R2 Teacher ${match[1]}`;
    }
    if (role === "admin" && identityKey === "multi-r2-admin") return "MULTI-PILOT-R2 Admin";
    return "";
  }

  async function login(role, identityKey) {
    const expectedPath = expectedPathFor(role);
    const expectedText = expectedIdentityText(role, identityKey);
    const qaLink = page.locator('a[href="/qa-login"], a[href$="/qa-login"]').first();
    if (await qaLink.count()) {
      await qaLink.click();
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
    } else if (!page.url().includes("/qa-login")) {
      await goto("/qa-login", `qa-login-${role}-${identityKey}`);
    }
    const logoutFormIndex = await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll("form"));
      const roleFormIndex = forms.findIndex((form) => Boolean(form.querySelector("#role")));
      const nonRoleFormIndex = forms.findIndex((form) => !form.querySelector("#role"));
      return nonRoleFormIndex !== -1 && roleFormIndex !== -1 && nonRoleFormIndex < roleFormIndex ? nonRoleFormIndex : -1;
    });
    if (logoutFormIndex >= 0) {
      await page.locator("form").nth(logoutFormIndex).locator('button[type="submit"]').click();
      await page.waitForLoadState("networkidle").catch(() => {});
      await goto("/qa-login", `qa-login-after-dom-logout-${role}-${identityKey}`);
    }
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
    if (!page.url().includes(expectedPath)) {
      await goto(expectedPath, `post-login-route-check-${role}-${identityKey}`);
    }
    const text = await bodyText();
    const wrongRoleText =
      (role === "student" && text.includes("หน้าที่สำหรับนักศึกษาเท่านั้น")) ||
      (role === "teacher" && text.includes("หน้าที่สำหรับอาจารย์เท่านั้น")) ||
      (role === "admin" && text.includes("หน้าที่สำหรับผู้ดูแลระบบเท่านั้น"));
    const ok = page.url().includes(expectedPath) && (!expectedText || text.includes(expectedText)) && !wrongRoleText;
    await step("LOGIN", { role, identityKey, expectedPath, expectedText, ok, url: page.url() });
    if (!ok) {
      await bug({
        severity: "Blocker",
        slug: `qa-login-role-mismatch-${role}-${identityKey}`,
        role,
        project: "QA session",
        route: page.url(),
        expected: `QA login should land on ${expectedPath} as ${expectedText || identityKey}.`,
        actual: text.slice(0, 700),
        suggestedFix: "Check QA login form selection, session cookie replacement, and automation role guard."
      });
      throw new Error(`QA login role mismatch for ${role}/${identityKey}`);
    }
  }

  async function fillIfExists(selector, value) {
    const target = page.locator(selector).first();
    if (await target.count()) {
      const disabled = await target.isDisabled().catch(() => false);
      if (!disabled) await target.fill(value);
      return { exists: true, disabled };
    }
    return { exists: false };
  }

  async function submitStudent02ProposalAfterLateOpen() {
    await login("student", "multi-r2-student-02");
    await goto("/student/proposal", "student02-proposal-after-late-open");
    const beforeShot = await screenshot("student02-late-proposal-before-fill");
    const submittedSummary = page.locator('[data-testid="student-proposal-submitted-summary"]').first();
    if (await submittedSummary.count()) {
      const lateSubmittedNotice = await page.locator('[data-testid="student-proposal-late-submitted-notice"]').count();
      const activeFormCount = await page.locator('form:has(input[name="project_title_th"])').count();
      const text = await bodyText();
      await step("STUDENT02_PROPOSAL_ALREADY_SUBMITTED", {
        beforeShot,
        lateSubmittedNotice: lateSubmittedNotice > 0,
        activeFormCount,
        snippet: text.slice(0, 700)
      });
      return {
        status: "already-submitted-readonly",
        beforeShot,
        lateSubmittedNotice: lateSubmittedNotice > 0,
        activeFormCount
      };
    }

    const fieldResults = {};
    fieldResults.titleTh = await fillIfExists('input[name="project_title_th"]', "MULTI-PILOT-R2 Project 02 Late Proposal Recovery");
    fieldResults.titleEn = await fillIfExists('input[name="project_title_en"]', "MULTI-PILOT-R2 Project 02 Late Proposal Recovery");
    fieldResults.abstract = await fillIfExists('textarea[name="abstract_of_talk"]', "Late proposal recovery test for MULTI-PILOT-R2 Project 02.");
    fieldResults.background = await fillIfExists('textarea[name="motivation_background"]', "ทดสอบการเปิดส่ง Proposal ย้อนหลังรายกรณีหลังปิดรอบ");
    fieldResults.objectives = await fillIfExists('textarea[name="objectives"]', "1. ตรวจสอบ late lock\n2. ตรวจสอบ admin reopen\n3. ตรวจสอบ reviewer queue");
    fieldResults.methods = await fillIfExists('textarea[name="proposed_methods"]', "ดำเนินการผ่านหน้าเว็บจริงโดยไม่ใช้ direct database update");
    fieldResults.outcomes = await fillIfExists('textarea[name="expected_outcomes"]', "ระบบควรบันทึก Proposal ได้หลัง Admin เปิดสิทธิ์รายกรณี และส่งต่อคิวกรรมการได้");
    fieldResults.questions = await fillIfExists('textarea[name="questions_for_teachers"]', "กรุณาตรวจว่าหลักฐาน late override แสดงครบหรือไม่");
    fieldResults.link = await fillIfExists('input[name="material_link"]', "https://drive.google.com/drive/folders/multi-pilot-r2-late-proposal-02");
    fieldResults.timelineActivity = await fillIfExists("#timeline_activity_0", "Late Proposal recovery test Project 02");
    fieldResults.timelineDeliverable = await fillIfExists("#timeline_deliverable_0", "Proposal document and late override evidence");
    if (await page.locator("#timeline_start_0").count()) await page.locator("#timeline_start_0").selectOption("1").catch(() => {});
    if (await page.locator("#timeline_end_0").count()) await page.locator("#timeline_end_0").selectOption("4").catch(() => {});
    if (await page.locator('input[name="student_declaration"]').count()) await page.locator('input[name="student_declaration"]').check().catch(() => {});

    const afterFillShot = await screenshot("student02-late-proposal-after-fill");
    const buttons = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button[type='submit'], form button")).map((button, index) => ({
        index,
        text: button.innerText,
        disabled: button.disabled
      }))
    );
    await step("STUDENT02_PROPOSAL_AFTER_FILL", { beforeShot, afterFillShot, fieldResults, buttons });

    const submitButton = page.locator('button[type="submit"], form button').filter({ hasText: /ส่ง|Proposal|เสนอหัวข้อ/ }).last();
    const disabled = await submitButton.isDisabled().catch(() => true);
    if (disabled) {
      await bug({
        severity: "Major",
        slug: "student02-late-open-proposal-submit-disabled-after-fill",
        role: "Student 02",
        project: "Project 02",
        route: "/student/proposal",
        expected: "After Admin opens late Proposal access and required fields are filled, Student 02 can submit.",
        actual: JSON.stringify(buttons),
        suggestedFix: "Check late exception gate and form validation/disabled state."
      });
      return { status: "disabled-after-fill", beforeShot, afterFillShot, buttons };
    }

    await submitButton.click();
    await page.waitForLoadState("networkidle").catch(() => {});
    const afterSubmitShot = await screenshot("student02-late-proposal-after-submit");
    const text = await bodyText();
    const hasSubmittedSummary = await page.locator('[data-testid="student-proposal-submitted-summary"]').count();
    const hasLateSubmittedNotice = await page.locator('[data-testid="student-proposal-late-submitted-notice"]').count();
    const activeFormCount = await page.locator('form:has(input[name="project_title_th"])').count();
    await step("STUDENT02_LATE_PROPOSAL_SUBMITTED", {
      afterSubmitShot,
      url: page.url(),
      hasSubmittedSummary: hasSubmittedSummary > 0,
      hasLateSubmittedNotice: hasLateSubmittedNotice > 0,
      activeFormCount,
      snippet: text.slice(0, 700)
    });
    if (!hasSubmittedSummary || activeFormCount > 0) {
      await bug({
        severity: "Major",
        slug: "student02-proposal-submit-state-not-readonly",
        role: "Student 02",
        project: "Project 02",
        route: "/student/proposal",
        expected: "After late Proposal submission, read-only submitted summary appears and the active submit form is hidden.",
        actual: JSON.stringify({ hasSubmittedSummary: hasSubmittedSummary > 0, hasLateSubmittedNotice: hasLateSubmittedNotice > 0, activeFormCount, snippet: text.slice(0, 500) }),
        suggestedFix: "Render submitted/read-only Proposal state separately from canSubmitProposal=false."
      });
    }
    return {
      status: hasSubmittedSummary && activeFormCount === 0 ? "submitted-readonly" : "submitted-state-mismatch",
      beforeShot,
      afterFillShot,
      afterSubmitShot,
      hasLateSubmittedNotice: hasLateSubmittedNotice > 0,
      activeFormCount
    };
  }

  async function teacherProposalVisibility() {
    const results = [];
    for (const key of ["multi-r2-teacher-01", "multi-r2-teacher-02", "multi-r2-teacher-03", "multi-r2-teacher-04"]) {
      await login("teacher", key);
      await goto("/teacher/proposals", `teacher-proposals-${key}`);
      const text = await bodyText();
      const visible = /Project 02|Student 02|R2STU02/.test(text);
      const shot = await screenshot(`teacher-${key}-student02-proposal-after-submit-visibility`);
      const result = { key, visible, shot, snippet: text.slice(0, 800) };
      results.push(result);
      await step("TEACHER_STUDENT02_PROPOSAL_AFTER_SUBMIT_VISIBILITY", result);
    }
    return results;
  }

  async function progress1ScoringVisibility() {
    const results = [];
    for (const key of ["multi-r2-teacher-01", "multi-r2-teacher-02", "multi-r2-teacher-03", "multi-r2-teacher-04"]) {
      await login("teacher", key);
      await goto("/teacher/progress1", `teacher-progress1-${key}`);
      const text = await bodyText();
      const shot = await screenshot(`teacher-${key}-progress1-project04-project05-visibility`);
      results.push({
        key,
        project04Visible: /Project 04|Student 04|R2STU04/.test(text),
        project05Visible: /Project 05|Student 05|R2STU05/.test(text),
        shot,
        snippet: text.slice(0, 900)
      });
      await step("PROGRESS1_PROJECT04_05_VISIBILITY", results.at(-1));
    }
    return results;
  }

  await step("RUN_START", { baseUrl: BASE_URL });
  const student02Submit = await submitStudent02ProposalAfterLateOpen();
  const proposalVisibility = await teacherProposalVisibility();
  const progress1Visibility = await progress1ScoringVisibility();
  await step("RUN_COMPLETE", { bugCount: bugs.length, student02Submit, proposalVisibility, progress1Visibility });

  return { bugCount: bugs.length, bugs, student02Submit, proposalVisibility, progress1Visibility };
}
