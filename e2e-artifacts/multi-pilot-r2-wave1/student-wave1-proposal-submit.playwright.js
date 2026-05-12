async (page) => {
  const base = "https://system-project-math-sci-7v0pnfhqv-lordtd-hubs-projects.vercel.app";
  const secret = "SET_QA_SECRET_BEFORE_RUNNING_AND_REMOVE_AFTER_USE";
  const students = ["01", "03", "04", "05"];

  for (const n of students) {
    await page.goto(`${base}/qa-login`);
    await page.getByLabel("บทบาท").selectOption("student");
    await page.locator("#student_email").selectOption(`multi-r2-student-${n}`);
    await page.getByPlaceholder("กรอก secret สำหรับ QA preview").fill(secret);
    await page.getByRole("button", { name: "เข้าสู่ระบบ QA" }).click();
    await page.waitForURL("**/student**", { timeout: 15000 });

    await page.goto(`${base}/student/proposal`);
    await page.locator('textarea[name="abstract_of_talk"]').fill(`Proposal abstract for MULTI-PILOT-R2 Project ${n}. This submission checks batch student proposal behavior and evidence continuity.`);
    await page.locator('textarea[name="motivation_background"]').fill("ระบบต้องรองรับนักศึกษาหลายคนส่งเอกสารในช่วงเวลาใกล้กัน โดยยังคงแสดงสถานะและคิวงานถูกต้อง");
    await page.locator('textarea[name="objectives"]').fill("1. ตรวจสอบ workflow การส่ง proposal แบบหลายผู้ใช้\n2. ตรวจสอบคิวอาจารย์และผู้ดูแลระบบ\n3. ตรวจสอบหลักฐานประกอบการประเมิน");
    await page.locator('textarea[name="proposed_methods"]').fill("ดำเนินการตามลำดับ: เตรียมข้อมูล ส่งเอกสาร ตรวจสถานะ ให้กรรมการประเมิน และบันทึกหลักฐาน");
    await page.locator('textarea[name="expected_outcomes"]').fill("ได้ข้อมูลทดสอบที่ช่วยระบุบัคด้านคิวงาน สถานะ และการแสดงผลใน dashboard");
    await page.locator("#timeline_activity_0").fill(`Prepare proposal evidence for Project ${n}`);
    await page.locator("#timeline_start_0").selectOption("1");
    await page.locator("#timeline_end_0").selectOption("4");
    await page.locator("#timeline_deliverable_0").fill("Proposal document and supporting Google Drive evidence");
    await page.locator('textarea[name="questions_for_teachers"]').fill("ขอให้อาจารย์ช่วยตรวจความครบถ้วนของขอบเขต วิธีดำเนินงาน และหลักฐานที่คาดว่าจะใช้");
    await page.locator('input[name="material_link"]').fill(`https://drive.google.com/drive/folders/multi-pilot-r2-proposal${n}`);
    await page.locator('input[name="student_declaration"]').check();
    await page.getByRole("button", { name: "ส่งเอกสารเสนอหัวข้อ" }).click();
    await page.waitForURL("**/student/proposal?success=proposal_submitted", { timeout: 15000 }).catch(async () => {
      await page.waitForLoadState("networkidle");
    });
    const submittedSummary = page.locator('[data-testid="student-proposal-submitted-summary"]');
    const activeSubmitForm = page.locator('form:has(input[name="project_title_th"])');
    if ((await submittedSummary.count()) === 0 || (await activeSubmitForm.count()) > 0) {
      throw new Error(`Project ${n} proposal submit did not reach read-only submitted state`);
    }
  }
}
