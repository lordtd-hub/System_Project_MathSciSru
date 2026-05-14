# MD Status Index

Last updated: 2026-05-14

Purpose: ทะเบียนสถานะไฟล์ Markdown ใน repo เพื่อแยกว่าไฟล์ไหนยังใช้อยู่, ไฟล์ไหนเป็นแผนที่ทำไปแล้ว/ปิดงานแล้ว, และไฟล์ไหนต้องถามก่อนลบหรือย้าย

Status legend:

- `ACTIVE`: ยังใช้เป็นเอกสารอ้างอิงหลักหรือสถานะปัจจุบัน
- `ACTIVE-STATUS`: ใช้ติดตามสถานะล่าสุด ต้องอัปเดตต่อ
- `REFERENCE`: งานเสร็จแล้ว แต่ควรเก็บเป็นหลักฐาน/ประวัติ
- `CLOSED-PLAN`: เป็นแผน/พรอมป์เก่าที่ทำจบแล้ว ไม่ใช่งานปัจจุบัน
- `DEFERRED`: เก็บไว้เป็นหนี้งานหรือแนวทางทำทีหลัง
- `QUESTION`: ยังไม่แน่ใจว่าคุณต้องการเก็บไหม ต้องถามก่อนย้าย/ลบ
- `DELETE-CANDIDATE`: มีแนวโน้มลบ/ย้ายได้ แต่ยังไม่ลบทันที

## Current Primary Documents

| File | Status | Notes |
|---|---:|---|
| `AGENTS.md` | ACTIVE | กติกาการทำงานของ agent/repo |
| `PROJECT_SPEC.md` | ACTIVE | specification หลักของระบบ |
| `IMPLEMENTATION_PROGRESS.md` | ACTIVE-STATUS | สถานะ implementation ปัจจุบัน ต้องอัปเดตต่อ |
| `E2E_LIFECYCLE_REVIEW.md` | ACTIVE | lifecycle review / guardrail สำคัญ |
| `UI_TERMINOLOGY_GUIDE.md` | ACTIVE | อ้างอิงคำศัพท์ UI ไทย |
| `README.md` | ACTIVE | เอกสารหน้า repo |
| `RUBRICS_CHECKLIST.md` | ACTIVE | rubric/checklist source |
| `DATA_MODEL_DRAFT.md` | ACTIVE | data model/history สำคัญ แม้บางส่วนเป็น draft |
| `SECURITY_REVIEW.md` | ACTIVE | security reference |
| `PRODUCTION_CHECKLIST.md` | ACTIVE | production safety checklist |
| `DEPLOYMENT_NOTES.md` | ACTIVE | deployment reference |
| `MANUAL_PRODUCTION_E2E_RUNBOOK.md` | ACTIVE | runbook production/manual |

## Current Status / Pilot Control Artifacts

| File | Status | Notes |
|---|---:|---|
| `e2e-artifacts/PILOT_FIX_STATUS.md` | ACTIVE-STATUS | สถานะ fix/pilot ล่าสุด |
| `e2e-artifacts/multi-pilot-r2-wave1/REPORT.md` | REFERENCE | Wave 1 full-cycle report เสร็จแล้ว เก็บเป็นหลักฐาน |
| `e2e-artifacts/multi-pilot-r2-wave1/MANUAL_NOTES.md` | REFERENCE | Notes จาก Wave 1 ใช้อ้างอิง UX debt |
| `e2e-artifacts/multi-pilot-r2-wave1/PENDING_FROM_PROMPT.md` | REFERENCE | รายการค้างจาก prompt เก่า ส่วนใหญ่ถูกปิด/แยก debt แล้ว |
| `e2e-artifacts/multi-pilot-r2-wave1/WAVE1_CLEANUP_STABILIZATION_REPORT.md` | REFERENCE | รายงาน cleanup/stabilization Wave 1 |
| `e2e-artifacts/multi-pilot-r2-wave1/WAVE1_REMAINING_FULL_LOOP_PLAN.md` | CLOSED-PLAN | แผนเก็บตก Wave 1 ถูกใช้แล้ว ปัจจุบันเป็น reference |
| `e2e-artifacts/multi-pilot-r2-wave1/WAVE2_PLANNING_NOTE.md` | REFERENCE | แนวคิด Wave 2 ใช้อ้างอิง ไม่ใช่คำสั่งทำงานปัจจุบัน |
| `e2e-artifacts/multi-pilot-r2/SETUP_PLAN.md` | REFERENCE | setup plan เก่า |

## Wave 2 Artifacts

หมายเหตุ: ผู้ใช้ยืนยันว่า Wave 2 multi-pilot รันแล้ว แต่ตอนนี้ไม่ได้ทำ Wave 2 execution กำลังอยู่ใน frontend/UI-only cleanup

| File | Status | Notes |
|---|---:|---|
| `e2e-artifacts/multi-pilot-r2-wave2/WAVE2_FULL_LOOP_PLAN.md` | CLOSED-PLAN | ใช้เป็นแผน Wave 2 ที่เคยรัน/อ้างอิง ไม่ใช่งานปัจจุบัน |
| `e2e-artifacts/multi-pilot-r2-wave2/REPORT.md` | REFERENCE | Wave 2 report/history |
| `e2e-artifacts/multi-pilot-r2-wave2/STATE_LOG.md` | REFERENCE | State log |
| `e2e-artifacts/multi-pilot-r2-wave2/BUG_LOG.md` | REFERENCE | Bug log |
| `e2e-artifacts/multi-pilot-r2-wave2/VALIDATION_LOG.md` | REFERENCE | Validation log |
| `e2e-artifacts/multi-pilot-r2-wave2/MANUAL_NOTES.md` | REFERENCE | Manual notes |

## Frontend UX Audit

| File | Status | Notes |
|---|---:|---|
| `e2e-artifacts/frontend-ux-audit/FRONTEND_UX_AUDIT.md` | ACTIVE-STATUS | audit หลัก ใช้สรุป readiness/debt |
| `e2e-artifacts/frontend-ux-audit/PRIORITY_FIX_LIST.md` | ACTIVE-STATUS | priority list ล่าสุด |
| `e2e-artifacts/frontend-ux-audit/ROLE_BY_ROLE_FINDINGS.md` | REFERENCE | findings แยก role |
| `e2e-artifacts/frontend-ux-audit/MOBILE_USABILITY_FINDINGS.md` | REFERENCE | mobile findings |
| `e2e-artifacts/frontend-ux-audit/SCREEN_INVENTORY.md` | REFERENCE | inventory หน้าที่ตรวจ |
| `e2e-artifacts/frontend-ux-audit/UI_TEXT_REVIEW.md` | ACTIVE | ใช้ต่อเวลาล้างภาษา programmer |
| `e2e-artifacts/frontend-ux-audit/BROWSER_RUNBOOK.md` | ACTIVE | วิธีใช้ browser/Playwright ที่ควรจำไว้ |

## Manual Guide Preparation

| File | Status | Notes |
|---|---:|---|
| `e2e-artifacts/manual-guide/QA_MANUAL_DATA_PREP.md` | ACTIVE-PLAN | แผนและ guard สำหรับ reset/seed QA เพื่อถ่ายคู่มือ |
| `e2e-artifacts/manual-guide/MANUAL_CAPTURE_PLAN.md` | ACTIVE-PLAN | แผนถ่ายคู่มือ 3 role จาก QA manual demo data |

## Admin / Teacher UX Stabilization

| File | Status | Notes |
|---|---:|---|
| `e2e-artifacts/admin-operational-ux/ADMIN_OPERATIONAL_AUDIT.md` | REFERENCE | audit admin ปิดรอบแล้ว |
| `e2e-artifacts/admin-operational-ux/ADMIN_QUEUE_DESIGN.md` | REFERENCE | design note admin ปิดรอบแล้ว |
| `e2e-artifacts/admin-operational-ux/VALIDATION_REPORT.md` | REFERENCE | validation admin UX |
| `e2e-artifacts/teacher-workload-ux/TEACHER_WORKLOAD_AUDIT.md` | REFERENCE | audit teacher ปิดรอบแล้ว |
| `e2e-artifacts/teacher-workload-ux/QUEUE_DESIGN.md` | REFERENCE | queue design teacher |
| `e2e-artifacts/teacher-workload-ux/VALIDATION_REPORT.md` | REFERENCE | validation teacher UX |

## Historical Reviews / Manuals

| File | Status | Notes |
|---|---:|---|
| `PILOT_READINESS_REVIEW.md` | REFERENCE | review เก่า |
| `PILOT_USER_MANUAL.md` | REFERENCE | manual draft/reference |
| `RESPONSIVE_UI_REVIEW.md` | REFERENCE | responsive review เก่า |
| `TESTING_MODE_REVIEW.md` | REFERENCE | testing mode review |
| `UX_WORKFLOW_REVIEW.md` | REFERENCE | UX workflow review |
| `SYNTHETIC_PILOT_SETUP.md` | REFERENCE | synthetic pilot setup |
| `CODEX_TASKS.md` | REFERENCE | task list historical/guardrail |

## Historical Prompts / Autonomous Work Plans

| File | Status | Notes |
|---|---:|---|
| `AUTONOMOUS_CODEX_PROMPT.md` | CLOSED-PLAN | prompt เก่า |
| `HOW_TO_USE_AUTONOMOUS_PROMPT.md` | CLOSED-PLAN | วิธีใช้ prompt เก่า |
| `MVP1_CODEX_PROMPT.md` | CLOSED-PLAN | MVP1 prompt เก่า |
| `prompts/00_autonomous_mvp1.md` | CLOSED-PLAN | historical prompt |
| `prompts/01_scaffold.md` | CLOSED-PLAN | historical prompt |
| `prompts/02_prisma_schema.md` | CLOSED-PLAN | historical prompt |
| `prompts/03_seed_teachers_rubric.md` | CLOSED-PLAN | historical prompt |
| `prompts/04_student_import.md` | CLOSED-PLAN | historical prompt |
| `prompts/05_auth_teacher_claim.md` | CLOSED-PLAN | historical prompt |
| `prompts/06_origin_and_proposal_submission.md` | CLOSED-PLAN | historical prompt |
| `prompts/07_proposal_scoring.md` | CLOSED-PLAN | historical prompt |
| `prompts/08_admin_summary_release.md` | CLOSED-PLAN | historical prompt |

## Redesign / Figma Related

| File | Status | Notes |
|---|---:|---|
| `WEBAPP_REDESIGN_PLAN.md` | QUESTION | tracked แต่ modified ค้าง และผู้ใช้พับ Figma redesign แล้ว ต้องถามว่าจะเก็บ/ปิด/ลบทิ้งไหม |

## Untracked / Needs Decision

กลุ่มนี้ยังไม่ถูก track ใน git หรือเป็น output เก่า จึงต้องถามก่อนย้าย/ลบ:

| File | Status | Question |
|---|---:|---|
| `PILOT_PERFORMANCE_TEST_01.md` | QUESTION | ยังใช้ต่อไหม หรือย้ายเข้ากองรอลบ? |
| `PILOT_QA_RUN.md` | QUESTION | ยังใช้ต่อไหม หรือย้ายเข้ากองรอลบ? |
| `PILOT_REALISTIC_QA_PLAN.md` | QUESTION | ยังใช้ต่อไหม หรือย้ายเข้ากองรอลบ? |
| `PILOT_USER_TEST_CHECKLIST.md` | QUESTION | ยังใช้ต่อไหม หรือย้ายเข้ากองรอลบ? |
| `e2e-artifacts/edge-stabilization-check/REPORT.md` | QUESTION | เป็นหลักฐาน browser stabilization เก่าหรือทิ้งได้? |
| `e2e-artifacts/full-pilot-round-4/REPORT.md` | QUESTION | เป็นหลักฐาน pilot รอบเก่าหรือทิ้งได้? |
| `e2e-artifacts/multi-user-pilot-r1/REPORT.md` | QUESTION | pilot R1 เก่า ต้องเก็บไหม? |
| `e2e-artifacts/pilot-retest-qa-70407a8/REPORT.md` | QUESTION | retest เก่า ต้องเก็บไหม? |
| `e2e-artifacts/pilot-round-2/PILOT_ROUND_2_REPORT.md` | QUESTION | pilot round 2 เก่า ต้องเก็บไหม? |
| `e2e-artifacts/pilot-round-3/PILOT_ROUND_3_LIVE_REVIEW.md` | QUESTION | pilot round 3 เก่า ต้องเก็บไหม? |

## Cleanup Review Docs

| File | Status | Notes |
|---|---:|---|
| `_cleanup_review/FILE_INVENTORY_2026-05-14.md` | ACTIVE-STATUS | บันทึกรายการไฟล์ที่ย้ายเข้ากองรอลบและรายการที่ต้องถาม |
| `MD_STATUS_INDEX.md` | ACTIVE-STATUS | ไฟล์นี้ ใช้เป็นทะเบียนสถานะ MD |

## คำถามที่ต้องตอบก่อน cleanup รอบถัดไป

1. ให้ย้าย untracked `PILOT_*.md` ทั้ง 4 ไฟล์เข้ากองรอลบไหม?
2. ให้ย้าย artifact เก่า `pilot-round-2`, `pilot-round-3`, `multi-user-pilot-r1`, `full-pilot-round-4`, `pilot-retest-qa-70407a8`, `edge-stabilization-check` ไหม?
3. `WEBAPP_REDESIGN_PLAN.md` ที่ modified ค้างอยู่ ต้องเก็บ, ปิดงาน, หรือ revert?
4. `.claude/worktrees/pedantic-booth-10773f` ยังต้องใช้ไหม? ถ้าไม่ใช้ควรลบด้วย `git worktree remove`
5. `design_reference/` และ `logo_mathscisru/` ให้เก็บไว้ก่อนหรือย้ายเข้ากองรอลบ?
