# Web App Redesign Plan

## สถานะเอกสาร

เอกสารนี้บันทึกแผนการปรับ visual/UX ของระบบ โดยอ้างอิงจากโฟลเดอร์ `design_reference/`

เป้าหมายคือปรับหน้าตาและประสบการณ์ใช้งานของ web app ให้ดูเป็นระบบวิชาการมากขึ้น อ่านง่ายขึ้น และช่วยให้ผู้ใช้เข้าใจ workflow ได้เร็วขึ้น โดยไม่เปลี่ยน logic หลักของระบบ

## หลักการสำคัญ

- Lifecycle v2 ยังเป็น workflow หลักของระบบ
- AssessmentRound ยังเป็น course-level round เท่านั้น
- ห้ามเปลี่ยน auth, role guard, lifecycle transition, Prisma schema หรือ business logic โดยไม่จำเป็น
- ใช้โลโก้ Mathematics & Statistics SRU เดิมของโปรเจค
- ใช้ `design_reference/` เป็น visual reference เท่านั้น ไม่ใช่ source app ใหม่
- ทำแบบค่อยเป็นค่อยไป เริ่มจาก shared UI ก่อน

## เป้าหมายของ redesign

1. ทำให้ระบบดูสะอาด ทันสมัย และมีเอกลักษณ์เชิงวิชาการ
2. ทำให้ Admin/Teacher/Student เข้าใจว่า “ต้องทำอะไรตอนนี้”
3. ทำให้ lifecycle state อ่านง่ายขึ้น
4. ลดความรกของ dashboard และหน้าสรุปต่าง ๆ
5. ทำให้ mobile ใช้งานได้จริงโดยไม่ overflow
6. รักษาความปลอดภัยและ workflow เดิมทั้งหมด

## สิ่งที่น่าสนใจจาก design_reference

### 1. Action Queue

เหมาะกับ Admin และ Teacher dashboard

แนวคิด:

- แสดงงานที่ต้องทำตอนนี้เป็นหลัก
- แยกงานที่รอผู้อื่นออกจากงานที่ผู้ใช้ต้องทำเอง
- ใช้ count/card ช่วยให้เห็นภาพรวมเร็ว

ตัวอย่างที่เหมาะกับระบบนี้:

- Proposal รอตัดสิน
- รอตั้งกรรมการ
- รอตรวจเล่ม
- รอ Advisor score
- รอ Admin closeout

### 2. Lifecycle Visualization

รูปแบบที่น่าสนใจ:

- Horizontal Stepper สำหรับหน้ารายละเอียดโครงงาน
- Compact Lifecycle Badge สำหรับ card/table
- Vertical Timeline สำหรับประวัติและ evidence trail
- Phase Kanban สำหรับ Admin overview

### 3. Student Task-First Dashboard

เหมาะกับหน้า `/student`

แนวคิด:

- แสดง project ปัจจุบัน
- แสดงสถานะ lifecycle ปัจจุบัน
- แสดง Next Action ชัดเจนที่สุด
- แสดงสิ่งที่เสร็จแล้วเป็นประวัติ
- แสดงอนาคตเป็น locked/future state

### 4. Teacher Scoring Workspace

เหมาะกับ:

- `/teacher/progress1`
- `/teacher/progress2`
- `/teacher/final`
- `/teacher/proposals`

แนวคิด:

- ฝั่งหนึ่งเป็น rubric/form
- อีกฝั่งเป็นคะแนนรวม feedback และสถานะ
- รวม success/error feedback ไว้ใกล้ action

### 5. Student Import Wizard

เหมาะกับ `/admin/import-students`

แนวคิด:

1. Upload CSV
2. Validate rows
3. เลือก course offering
4. Confirm import

ควรใช้หลังจาก UI หลักนิ่งแล้ว เพราะมีความเสี่ยงต่อ flow การ import

### 6. Closeout Checklist

เหมาะกับ `/admin/closeout`

แนวคิด:

- แสดง checklist ของเงื่อนไข completion
- Progress 1 score
- Progress 2 score
- Final presentation score
- Report approved
- Advisor score
- No unresolved report revision

## Risk Classification

### ความเสี่ยงต่ำ

ทำได้ก่อน เพราะเป็น visual/component เป็นหลัก

- ปรับสี spacing border shadow radius
- ปรับ button/card/badge/alert
- ปรับ `StatusBadge` ให้มี visual cue ชัดขึ้น
- ปรับ `NextActionCard` ให้เด่นขึ้น
- ปรับ home/login ให้ดูเป็นทางการขึ้น
- ปรับ empty state
- ปรับ locked/current/completed visual state
- ปรับ mobile spacing และปุ่มให้กดง่าย
- ปรับ logo sizing/header spacing
- ปรับ timeline ให้ดูอ่านง่ายขึ้น

### ความเสี่ยงต่ำถึงกลาง

ทำได้ แต่ต้อง run typecheck/test/build/e2e หลังแก้

- ปรับ shared header/layout
- ปรับ global CSS/Tailwind tokens
- ปรับ `LifecycleStepper` visual ใหม่
- ปรับ responsive table/card behavior
- ปรับ dashboard card layout โดยใช้ query เดิม
- ปรับ Teacher scoring layout โดยใช้ server action เดิม
- ปรับ Student dashboard grouping โดยใช้ `getStudentAvailableActions` เดิม
- เพิ่ม compact lifecycle badge ใน card/table

### ความเสี่ยงกลาง

ควรวางแผนก่อนและเพิ่ม tests เพราะอาจทำให้ action หายหรือแสดงข้อมูลผิด

- ทำ Admin dashboard เป็น Action Queue ใหม่
- ทำ Student dashboard แบบ task-first ใหม่
- ทำ Teacher dashboard แสดงเฉพาะงานของอาจารย์แบบละเอียด
- ทำ Proposal Summary mobile card layout ใหม่
- ทำ scoring workspace ใหม่ที่ย้ายตำแหน่ง form/action
- ทำ Import Student wizard หลายขั้น
- ทำ Closeout checklist UI ใหม่
- ทำ Round management card ใหม่
- ทำ lifecycle phase/kanban summary
- รวม/ย้ายเมนู Admin/Teacher/Student

### ความเสี่ยงสูง

ยังไม่ควรทำในรอบ visual polish ปกติ

- เปลี่ยน route structure
- เปลี่ยน role navigation logic
- ทำ sidebar ใหม่แทน header/nav เดิมทั้งระบบ
- เปลี่ยน dashboard query/service ใหม่โดยไม่จำเป็น
- ทำ lifecycle visualization ที่มี logic แยกจาก service เดิม
- ทำ kanban drag/drop ที่เปลี่ยน project status
- ทำ import wizard ที่เปลี่ยน server-side import flow จริง
- ทำ scoring UI ใหม่พร้อมเปลี่ยน payload/schema
- เพิ่ม modal/drawer ที่ submit server action ใหม่เอง
- เปลี่ยน auth/session display logic
- เพิ่ม automatic transition จาก UI เช่นปิด Proposal แล้วเปิด Progress 1 เอง

## Recommended Implementation Order

### Phase 1: Safe Shared UI Polish

- ปรับ shared tokens, card, button, badge, alert
- ปรับ header/logo spacing
- ปรับ empty/locked/current state
- ปรับ timeline และ lifecycle visual แบบไม่เปลี่ยน logic

### Phase 2: Dashboard Clarity

- ปรับ Admin dashboard ให้ grouped ชัดขึ้นโดยใช้ query เดิมก่อน
- ปรับ Teacher dashboard ให้เน้นงานที่ต้องทำ
- ปรับ Student dashboard ให้ Next Action เด่นขึ้น

### Phase 3: Workflow-Specific Screens

- ปรับ Teacher scoring workspace
- ปรับ Admin closeout checklist UI
- ปรับ Proposal/Round summary ให้ตัดสินใจง่ายขึ้น

### Phase 4: Higher-Risk UX Improvements

- พิจารณา Student import wizard
- พิจารณา Admin phase kanban overview
- พิจารณา desktop sidebar เฉพาะ Admin/Teacher หากจำเป็น

## Validation Required For Redesign Work

อย่างน้อยต้องรัน:

```bash
cmd /c npm.cmd run typecheck
cmd /c npm.cmd test
cmd /c npm.cmd run build
```

ถ้าแก้ shared layout หรือ component ที่ใช้หลายหน้า ควรรันเพิ่ม:

```bash
cmd /c npm.cmd run e2e:lifecycle
```

## Manual QA Checklist

- Home page ดูเป็นทางการและไม่รก
- Header แสดงโลโก้และ role ชัดเจน
- ADMIN • TEACHER ไม่ทำให้ปุ่มซ้ำซ้อนเกินไป
- Admin dashboard เห็นงานที่ต้องทำต่อ
- Teacher dashboard เห็นงานที่ต้องประเมิน/ตรวจ
- Student dashboard เห็น Next Action ชัดเจน
- Lifecycle state อ่านเข้าใจ
- Mobile 390px ไม่มี horizontal overflow
- ปุ่มหลักกดง่าย
- ไม่มี action สำคัญหายไป
- ไม่มีการเปลี่ยน lifecycle/auth/guard โดยไม่ตั้งใจ

## Redesign Alignment Checklist

### Current issue

- Current UI work is mostly safe polish on the old layout.
- It does not yet fully match the `design_reference` visual language.

### Target direction

- Academic operational app.
- Compact role navigation.
- Workflow/action-queue oriented dashboards.
- Clearer lifecycle visualization.
- Warmer red/paper/ink visual tone.
- Stronger section hierarchy.

### Low-risk next alignment tasks

- Align shared visual tokens with `design_reference/styles/tokens.css`.
- Polish `Card`, `Button`, `Badge`, `PageHeader`, and `NextActionCard` styles.
- Introduce a shared section heading component or pattern.
- Make dashboard cards closer to an action queue style.
- Improve empty, loading, and locked states consistently.

### Medium-risk tasks

- Mobile card redesign for workflow-heavy pages.
- Scoring workspace layout refinement.
- Proposal, round, and closeout page hierarchy refactor.

### High-risk tasks to defer

- Full sidebar/routing redesign.
- Route structure changes.
- Workflow visualization that changes business interpretation.
- Import wizard rewrite.
- Lifecycle/action logic changes.

### Rule for future UI tasks

- Shared components first.
- One small patch at a time.
- No auth, lifecycle, schema, or business logic changes.
- Preserve production stability.
- Validate with `cmd /c npm.cmd run typecheck`, `cmd /c npm.cmd test`, and `cmd /c npm.cmd run build`.

## Current Recommendation

เริ่มจากงานความเสี่ยงต่ำและต่ำถึงกลางก่อน ได้แก่:

1. Shared visual polish เพิ่มเติม
2. Empty/locked/current state UI
3. Compact lifecycle badge
4. Student dashboard visual grouping โดยใช้ action data เดิม
5. Teacher scoring layout polish โดยไม่เปลี่ยน action
6. Admin dashboard card polish โดยไม่เปลี่ยน query

งานที่ควรรอ:

- Sidebar เต็มระบบ
- Import wizard หลายขั้น
- Admin kanban
- Drag/drop workflow
- การย้าย route/menu ขนาดใหญ่
