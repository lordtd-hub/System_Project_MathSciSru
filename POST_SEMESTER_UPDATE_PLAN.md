# Post-Semester Update Plan

บันทึกแผนอัปเดตเวอร์ชันถัดไปสำหรับระบบ Mathematical Project Course Management System

วันที่บันทึก: 2026-05-18

## สถานะและหลักการ

ระบบ production ใช้งานจริงระหว่างภาคเรียนแล้ว แผนนี้เป็นงานหลังเทอมหรือช่วง maintenance window เท่านั้น ยังไม่ใช่งานที่ควรทำระหว่าง active semester เว้นแต่มีการอนุมัติชัดเจน

หลักการสำคัญ:

- ไม่เปลี่ยน lifecycle/scoring/auth/eligibility semantics ระหว่างภาคเรียน
- ไม่แตะ production DB แบบ destructive
- รักษา audit/evidence history เดิมทั้งหมด
- เริ่มจาก `main` บน branch ใหม่ `codex/...`
- ทดสอบบน preview/QA DB ก่อน production เสมอ

## Feature 1: AUN-QA Review Link

เป้าหมาย: ให้ผู้ตรวจ AUN-QA สามารถเข้าดูระบบและหลักฐานได้ผ่านลิงก์ที่ Admin สร้าง เปิด/ปิดเองได้

พฤติกรรมหลัก:

- Admin สร้าง AUN-QA review link ได้
- Admin เปิด/ปิด link เองหลังการตรวจเสร็จสิ้น
- ไม่มี default expiry ใน v1
- ผู้ตรวจเห็นหน้าแบบ read-only ใกล้เคียง Admin evidence/read-only
- ห้ามมี form/action ที่แก้ข้อมูลในหน้า review
- รองรับการดู dashboard หลักฐาน, timeline, export หลักฐานที่จำเป็น
- รองรับการดูเกณฑ์ rubric และ marking scheme ที่ใช้จริง เพื่อให้ผู้ตรวจเห็นว่าแต่ละรอบประเมินใช้เกณฑ์อะไรและคำนวณคะแนนอย่างไร
- บันทึก audit เมื่อสร้าง link, เปิด link, ปิด link, และเมื่อมีการเข้าดู

Rubric and marking scheme viewer:

- แสดง rubric active version ของ Proposal, Progress 1, Progress 2 และ Final Presentation
- แสดงชื่อ rubric, version, group/criteria, item label, คะแนนเต็ม, critical/evidence hint ถ้ามี
- แสดง marking scheme ระดับรายวิชา: Proposal 10%, Progress 1 10%, Progress 2 10%, Final Presentation 10%
- แสดงว่า report/article numeric scoring ยังอยู่นอก scope และ report workflow เป็น approval/revision evidence เท่านั้น
- แสดงว่า Advisor score 25% เป็น component แยก ไม่ผูกกับ `AssessmentRound`
- แสดงแนวคำนวณคะแนน: คะแนนดิบต่อรอบเป็น 100 แล้วถ่วงน้ำหนักตาม `AssessmentRound.courseWeight`
- ต้องอ่านจาก data/config จริงในระบบ ไม่ hard-code ข้อความ rubric ซ้ำในหน้า AUN-QA

แนว schema:

- เพิ่ม model เช่น `AunQaReviewLink`
- เก็บ `tokenHash`, `label`, `active`, `createdByAdminId`, `createdAt`, `disabledAt`, `lastAccessedAt`
- ไม่เก็บ token plain text

แนว route/UI:

- Admin manage page เช่น `/admin/aunqa-links`
- Public read-only route เช่น `/review/aunqa/[token]`
- ใช้ข้อมูลจาก evidence service เดิมให้มากที่สุด

ข้อควรระวัง:

- ไม่ให้ผู้ตรวจเข้าถึง Admin mutation actions
- ระวังข้อมูลส่วนตัวของนักศึกษา/อาจารย์ที่ไม่จำเป็น
- export ต้องไม่เปิดเผย secrets, env, token หรือ private system metadata

## Feature 2: External Examiner Scoring Link

เป้าหมาย: รองรับกรรมการนอกสาขา/นอกระบบอาจารย์ภายใน ให้ประเมิน Progress 1, Progress 2 และ Final Presentation ได้ผ่าน generated link

ขอบเขต:

- ใช้ได้เฉพาะ `PROGRESS_1`, `PROGRESS_2`, `FINAL_PRESENTATION`
- ไม่ใช้กับ Proposal/Re-proposal
- ไม่ใช้กับ report review
- ไม่ใช้กับ advisor score
- กรรมการนอกสาขาประเมินคะแนนอย่างเดียว ไม่ต้องอนุมัติวันสอบ

Flow ที่ต้องการ:

1. นักศึกษาส่งคำขอเพิ่มกรรมการนอกสาขา
2. นักศึกษาระบุชื่อ, สังกัด, ช่องทางติดต่อ, รอบสอบที่เกี่ยวข้อง, เหตุผล
3. Admin ตรวจและอนุมัติ/ปฏิเสธ
4. เมื่อ Admin อนุมัติ ระบบสร้าง assessment link + PIN
5. Admin ส่ง link และ PIN ให้กรรมการเองแบบ manual ใน v1
6. กรรมการเปิด link และกรอก PIN
7. ระบบแสดงเฉพาะงาน/รอบที่ได้รับอนุมัติ
8. กรรมการส่งคะแนนและ feedback
9. ระบบล็อกคะแนนและบันทึก timeline/audit

สิทธิ์และความปลอดภัย:

- ใช้ Token + PIN
- token และ PIN ต้องเก็บเป็น hash เท่านั้น
- token scope ต้องผูกกับ project + round + external examiner
- link ต้อง revoke ได้โดย Admin
- link ที่ revoked หรือ score submitted แล้วต้องไม่เปิด form ให้แก้ซ้ำ
- external examiner ห้ามเข้าถึง teacher dashboard, admin pages, student pages หรือ project อื่น

แนว schema:

- เพิ่ม model เช่น `ExternalExaminer`
- เพิ่ม model เช่น `ExternalExaminerRequest`
- เพิ่ม model หรือ field สำหรับ token/PIN เช่น `ExternalExaminerAccessLink`
- ขยาย `EvaluatorAssignment` ให้รองรับ external evaluator โดยไม่ต้องมี `evaluatorUserId`/`teacherId`
- เพิ่ม `externalExaminerId` หรือ reference ที่เทียบเท่า
- คง `evaluatorDisplayNameSnapshot` เพื่อหลักฐานตอนบันทึกคะแนน

Scoring behavior:

- ใช้ rubric และ `ScoreSubmission`/`ScoreItem` เดิมให้มากที่สุด
- External examiner ที่ Admin อนุมัติแล้วนับเป็น required evaluator เหมือนกรรมการสอบ
- Completion logic ต้องนับ required evaluator จาก assignment ไม่ใช่ดูเฉพาะ `teacherId`
- คะแนนของ external examiner รวมใน evidence และ average เหมือน evaluator ที่ required คนอื่น
- หากยังไม่ส่งคะแนน ต้องแสดงเป็น missing required score ใน evidence/completion

Timeline/Audit:

- สร้าง timeline event เมื่อ Admin อนุมัติกรรมการนอกสาขา
- สร้าง timeline event เมื่อ external examiner ส่งคะแนน
- audit log สำหรับสร้าง/revoke link, approve/reject request, submit score
- เก็บ display name snapshot ของกรรมการตอน submit

## Feature 3: Supabase Security Hardening

เป้าหมาย: ทำ defense-in-depth ให้ฐาน Production และ QA โดยคงรูปแบบการเชื่อมต่อหลักผ่าน Next.js/Prisma ฝั่งเซิร์ฟเวอร์ และไม่เปิดตารางข้อมูลรายวิชาให้ Supabase Data API โดยไม่จำเป็น

สถานะชั่วคราวระหว่างภาคเรียน:

- Production และ QA ต้องแสดง `0 of N tables exposed` ใน Data API settings
- ปิด `Automatically expose new tables` ทั้ง Production และ QA
- แอปยังเชื่อม PostgreSQL ผ่าน `DATABASE_URL`/`DIRECT_URL` ฝั่งเซิร์ฟเวอร์เท่านั้น
- ห้ามเพิ่ม `NEXT_PUBLIC_SUPABASE_*`, publishable key, anon key หรือ service-role key ลง frontend
- ตรวจ Security Advisor หลังมี migration หรือเพิ่มตารางใหม่ทุกครั้ง

งานอัปเกรดหลังจบเทอม:

1. สำรอง Production ด้วย `pg_dump` และทดสอบอ่านไฟล์ backup ก่อนเริ่ม maintenance
2. ตรวจ schema, table owner, grants, default privileges, views, functions, sequences และ exposed schemas ของ Production/QA
3. เปิด RLS แบบ default-deny ให้ตารางข้อมูลแอปทั้งหมด โดยยังไม่สร้าง policy แบบกว้างให้ `anon` หรือ `authenticated`
4. ออกแบบ policy รายบทบาทเฉพาะเมื่อมี use case ที่ต้องใช้ Supabase Data API จริง ห้ามใช้เพียง `TO authenticated` โดยไม่มี ownership predicate
5. พิจารณาย้าย API ที่จำเป็นในอนาคตไป custom schema เช่น `api` และไม่ expose schema `public`
6. สร้าง dedicated runtime database role สำหรับแอป แยกจาก migration/owner role และให้สิทธิ์เท่าที่จำเป็น
7. ตรวจว่า Prisma runtime, Prisma migration, GitHub heartbeat และ backup script ใช้ role/connection ที่เหมาะสมแยกกัน
8. ปิดหรือ rotate legacy anon key เมื่อยืนยันแล้วว่าไม่มี consumer ใช้งาน และทบทวน publishable/service-role/database credentials ทั้งหมด
9. เพิ่ม automated security checks สำหรับ RLS, grants, default privileges และ Data API exposure ใน release checklist
10. รัน Supabase Security Advisor และตรวจ API/Postgres logs หลัง rollout

QA test matrix:

- `anon` อ่าน/เพิ่ม/แก้/ลบทุกตารางข้อมูลแอปไม่ได้
- `authenticated` อ่าน/เพิ่ม/แก้/ลบทุกตารางข้อมูลแอปไม่ได้ หากไม่มี policy เฉพาะ
- Prisma runtime role อ่านและเขียนตาม workflow ของระบบได้
- migration role สร้าง/แก้ schema ได้เฉพาะใน maintenance flow
- นักศึกษาเข้าถึงเฉพาะข้อมูลของตนผ่านแอป
- อาจารย์และ Admin ทำ workflow เดิมได้ครบ
- Google OAuth, LINE notification และ audit/evidence history ทำงานเหมือนเดิม
- QA login/tools ยังปิดใน Production

Rollout และ rollback:

- ทำบน QA ก่อน Production เสมอ
- ใช้ migration ที่ review ได้และมีคำสั่งตรวจผลแยกจากคำสั่งเปลี่ยนแปลง
- deploy preview และทดสอบ workflow สำคัญก่อน maintenance window
- หาก Prisma ได้รับผลกระทบ ให้ rollback grants/RLS ตามสคริปต์ที่เตรียมไว้ ห้าม restore ฐานทั้งก้อนโดยไม่จำเป็น
- ห้ามลบหรือเขียนทับ audit/evidence history ระหว่าง hardening

## Test Plan

Unit tests:

- token/PIN hashing and validation
- external examiner allowed only Progress 1/2/Final
- rejected/revoked/used link cannot submit score
- completion logic counts required external examiner
- AUN-QA link active/disabled access guard
- AUN-QA rubric/marking scheme viewer uses active rubric data and current round weights

Integration/source tests:

- AUN-QA read-only page has no mutation forms/server actions
- AUN-QA read-only page shows rubric criteria and marking scheme without hard-coded stale rubric copies
- external examiner cannot access wrong project/round
- external examiner cannot submit duplicate score
- student request requires own project
- admin approve/revoke creates audit log

Manual QA on preview DB:

- Admin creates AUN-QA link, opens review page, verifies evidence dashboard, rubric viewer, marking scheme, exports evidence, disables link, confirms access denied
- Student requests external examiner for Progress 1
- Admin approves and copies link/PIN
- External examiner submits score
- Project completion/evidence reflects internal + external required scores
- Confirm production QA/dev login tools remain disabled

## Rollout Notes

- ทำหลังเทอมหรือ maintenance window เท่านั้น
- เริ่มจาก backup production DB ก่อน migration
- deploy preview ก่อน merge
- smoke test production หลัง deploy โดยไม่ mutate ข้อมูลจริง
- หากมี production issue ให้ rollback code ก่อน และห้าม restore DB เว้นแต่จำเป็นจริงและมี backup ยืนยันแล้ว
