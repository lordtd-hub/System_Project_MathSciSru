# Production Maintenance Log

เอกสารนี้บันทึกเฉพาะการเปลี่ยนแปลงที่กระทบ Production ห้ามบันทึก secrets, passwords, connection strings, private tokens หรือข้อมูลส่วนบุคคล

## 2026-07-29 - Supabase Data API exposure containment

ประเภท: Production security incident / configuration hotfix

Project:

- Production: `project-course-system`
- Supabase project reference: `moowtfeoxgmkerfrtxyz`

เหตุการณ์:

- Supabase Security Advisor แจ้ง `rls_disabled_in_public`
- ตรวจพบตารางใน schema `public` จำนวน 38 ตารางไม่มี RLS
- ก่อนแก้ role `anon` และ `authenticated` มี CRUD privileges บนตารางทั้ง 38 ตาราง
- Data API settings เปิดเผย `38 of 38 tables`
- `Automatically expose new tables` เปิดอยู่
- โค้ดแอปใช้ Prisma/PostgreSQL ฝั่งเซิร์ฟเวอร์ และไม่พบ Supabase client หรือ public Supabase key ใน frontend
- API logs ที่ตรวจได้ในช่วง 24 ชั่วโมงล่าสุดไม่พบคำขอ `/rest/v1` จากภายนอก แต่ข้อมูลช่วงนี้ไม่ใช่หลักฐานยืนยันย้อนหลังทั้งหมด

การแก้ไขเฉพาะหน้า:

- เปลี่ยน Data API exposed tables จาก `38 of 38` เป็น `0 of 38`
- ปิด `Automatically expose new tables`
- ไม่เปลี่ยน lifecycle, scoring, authentication หรือ eligibility semantics
- ไม่แก้ไขหรือลบข้อมูล Production
- ยังไม่เปิด RLS ใน hotfix นี้ งาน RLS แบบเต็มอยู่ใน `POST_SEMESTER_UPDATE_PLAN.md`

ผลตรวจหลังแก้:

- ตารางที่ `anon` มี CRUD access: `0 of 38`
- ตารางที่ `authenticated` มี CRUD access: `0 of 38`
- Supabase Security Advisor: ไม่พบ security lint
- QA มี baseline เดียวกันอยู่ก่อนแล้ว: `0 of 38 tables exposed` และปิด auto-expose
- Production smoke test หลังแก้ตอบ HTTP 200 ที่ `/`, `/login`, `/student/project`, `/teacher/advisor-requests` และ `/admin`

Rollback:

- ไม่ต้อง restore database
- หากมี consumer ที่ได้รับอนุมัติและจำเป็นต้องใช้ Data API ให้เปิดเฉพาะ table/operation ที่จำเป็นหลังออกแบบ RLS policy แล้ว
- ห้ามเปิด `Automatically expose new tables` เป็นวิธี rollback

งานติดตาม:

- ตรวจ Security Advisor หลัง migration หรือสร้างตารางใหม่ทุกครั้ง
- ดำเนินการ Supabase Security Hardening เต็มรูปแบบหลังจบเทอม

## 2026-08-12 - Student reliability and user-blocker rollout closeout

ประเภท: Production reliability maintenance

Production:

- URL: `https://system-project-math-sci-sru.vercel.app`
- Final GitHub main: `5a8c1622a1a35b24134c636694e372689b2dbe4f`
- Final Vercel deployment: `dpl_EnZ5BgVC8hPomtb1bBP2MJHqBnfB`
- Vercel deployment status: `READY`

Patches ที่ปล่อย:

| Patch | PR | Merge commit | Rollback tag |
| --- | --- | --- | --- |
| Student form recovery | #16 | `73aeadf5f52d33851a1bb27ffe1fbea670e7f89a` | `prod-before-pr16-20260812-1653` |
| User-blocker containment | #19 | `1446f2d78f1e188097621878431b40d7c6eface7` | `prod-before-pr19-20260812-1810` |
| Current-stage atomic student actions | #17 | `aec8bf8afca87ac33485c03ebcf0fbd7d6995a93` | `prod-before-pr17-20260812-1916` |
| Future-stage atomic student actions | #18 | `5a8c1622a1a35b24134c636694e372689b2dbe4f` | `prod-before-pr18-20260812-2035` |

ผลการเฝ้าดูและตรวจสอบ:

- แต่ละ patch ผ่านการเฝ้าดู Production ครบ 60 นาที
- Deployment สุดท้ายผ่าน full-stack soak เพิ่มอีก 30 นาที
- Production HTTP: `/`, `/api/auth/session`, `/teacher` และ `/teacher/proposals` ตอบ HTTP 200; เส้นทางที่ไม่มีจริงตอบ HTTP 404
- Read-only browser smoke แสดงหน้าแรก, Teacher access guard และ Student access guard โดยไม่พบ application หรือ console error
- Vercel CLI ไม่พบ Production `5xx` request log หรือ error-level runtime log ในการตรวจช่วงสามชั่วโมงสุดท้าย
- Production Supabase `project-course-system` เป็น `ACTIVE_HEALTHY` และ read-only `SELECT 1` สำเร็จ
- QA Supabase `lordtd-hub's project-scoring` เป็น `ACTIVE_HEALTHY` และ read-only `SELECT 1` สำเร็จ
- ไม่ได้รับรายงานจากผู้ใช้ที่ตรงกับเงื่อนไข rollback ระหว่าง observation window

ขอบเขตการเปลี่ยนแปลง:

- ไม่มี database migration หรือการเปลี่ยน environment variable
- ผู้ปฏิบัติงานไม่ได้แก้ Production database หรือส่ง Production form
- ไม่มีการ rollback และไม่มีการลบ audit/evidence history
- เก็บ rollback tag ทั้งสี่รายการไว้
- GitHub Supabase heartbeat เป็นระบบแยกและไม่ได้ถูกแก้ไข

ผลลัพธ์:

- ปิด rollout สำเร็จ โดย Production คงอยู่ที่ `main@5a8c162`
- เหตุ data loss, ปุ่มค้าง, 500/digest, assignment ซ้ำ, partial commit, rubric ถูกเขียนจาก page load, lifecycle/auth failure, notification ซ้ำ หรือ workload mismatch ที่พบภายหลัง ให้เปิดเป็น Production incident ใหม่

## 2026-08-13 - Proposal revision and Re-proposal rollout closeout

ประเภท: Production lifecycle maintenance

Production:

- URL: `https://system-project-math-sci-sru.vercel.app`
- Final GitHub main: `e32489bb2019e99e67b1df51423608bcdd826c5e`
- Final Vercel deployment: `dpl_61joHX1Mk6JSRoyGYPabRxgWJvv6`
- Vercel deployment status: `READY`

Patches ที่ปล่อย:

| Patch | PR | Merge commit | Rollback tag |
| --- | --- | --- | --- |
| Proposal revision and advisor approval | #20 | `3beef0b9c7e20b1600d8fd8778104fce346ac87c` | `prod-before-pr20-20260813-0750` |
| Re-proposal attempt chain | #21 | `e32489bb2019e99e67b1df51423608bcdd826c5e` | `prod-before-pr21-20260813-0906` |

ผลการทดสอบและเฝ้าดู:

- PR #20 และ PR #21 ผ่าน Production observation อย่างน้อย 60 นาทีต่อ patch
- QA ทดสอบ revision, audited unlock, `NOT_PASS`, หัวข้อและที่ปรึกษาใหม่, Re-proposal attempt 2/3, retry และ concurrent submission ผ่าน workflow ปกติ
- ยืนยันว่ารอบ Proposal ระดับรายวิชายังคงเป็น `SCORING_CLOSED`, attempt เก่ายังคงปิด และไม่มี late penalty
- Final Production HTTP ที่ `/`, `/login`, `/admin/proposals` และ `/teacher/proposals` ตอบ HTTP 200
- Read-only Edge smoke แสดงหน้า Admin Proposal และ Teacher Proposal ครบ โดยไม่พบ digest, application error หรือ console error
- Vercel deployment สุดท้ายยังเป็น `READY`; ไม่พบ error-level runtime log หรือ Production `5xx` ในช่วงตรวจหลังปล่อย
- Production Supabase `project-course-system` เป็น `ACTIVE_HEALTHY` และ read-only `SELECT 1` สำเร็จ
- QA Supabase `lordtd-hub's project-scoring` เป็น `ACTIVE_HEALTHY` และ read-only `SELECT 1` สำเร็จ
- ไม่ได้รับรายงานจากผู้ใช้ที่ตรงกับเงื่อนไข rollback ระหว่าง observation window

ขอบเขตและความปลอดภัย:

- ไม่มี database migration หรือการเปลี่ยน environment variable
- การตรวจ Production เป็น read-only; ผู้ทดสอบไม่ได้แก้ Production database หรือส่ง Production form
- ไม่มี rollback และไม่มีการลบหรือแก้ไข audit/evidence history เดิม
- เก็บ rollback tag ของทั้งสอง patch ไว้บน remote
- GitHub Supabase heartbeat เป็นระบบแยกและไม่ได้ถูกแก้ไข

ผลลัพธ์:

- ปิด Proposal lifecycle rollout สำเร็จ โดย Production คงอยู่ที่ `main@e32489b`
- เหตุผิดปกติที่พบหลัง closeout ให้เปิดเป็น Production incident ใหม่และอ้างอิง deployment/rollback tag ข้างต้น

## 2026-08-15 - Controlled assessment-round opening rollout closeout

ประเภท: Production operations maintenance

Production:

- URL: `https://system-project-math-sci-sru.vercel.app`
- GitHub main ก่อนปล่อย: `0268ba94c11143886e3782df91c14c5f656d52f2`
- Final GitHub main: `53d886c0c9dcd2679428d0d5c83356d01c178812`
- Final Vercel deployment: `dpl_ork7h6nka6hDgFDbUkCjM6TVFFTk`
- Vercel deployment status: `READY`
- Rollback deployment: `dpl_DV21xr7dSKBTTXmEST1oPXbGzHpH`
- Rollback tag: `prod-before-pr26-20260815-1808`

Patch ที่ปล่อย:

| Patch | PR | Merge commit |
| --- | --- | --- |
| Controlled opening of assessment rounds with zero ready projects | #26 | `53d886c0c9dcd2679428d0d5c83356d01c178812` |

ผลการทดสอบและเฝ้าดู:

- QA ยืนยัน flow เปิดรอบแบบมีผู้พร้อม `0` ผ่าน Server Action และหน้าแสดงสถานะที่ commit แล้ว
- Production ผ่าน observation ครบ 60 นาที โดยตรวจทันทีและที่ประมาณนาที 15, 30, 45 และ 60
- Production HTTP ที่ `/` และ `/admin/rounds` ตอบ HTTP 200 ทุก checkpoint
- Read-only browser smoke แสดงหน้าแรกและ Admin access guard โดยไม่พบ application หรือ console error
- Vercel deployment คงเป็น `READY`; ไม่พบ error-level runtime log หรือ Production `5xx` ตลอดช่วง observation
- Production Supabase `project-course-system` เป็น `ACTIVE_HEALTHY` และ read-only `SELECT 1` สำเร็จทุก checkpoint
- QA Supabase `lordtd-hub's project-scoring` เป็น `ACTIVE_HEALTHY` และ read-only `SELECT 1` สำเร็จทุก checkpoint
- GitHub main คงอยู่ที่ merge commit ของ PR #26 และ rollback tag อยู่บน remote ตลอดช่วงตรวจ
- ไม่ได้รับรายงานจากผู้ใช้ที่ตรงกับเงื่อนไข rollback

ขอบเขตและความปลอดภัย:

- ไม่มี database migration หรือการเปลี่ยน environment variable ใน Production
- การตรวจ Production เป็น read-only; ผู้ทดสอบไม่ได้เปิดรอบ ส่ง Production form หรือแก้ Production database
- ไม่มี rollback และไม่มีการลบหรือแก้ไข audit/evidence history เดิม
- GitHub Supabase heartbeat เป็นระบบแยกและไม่ได้ถูกเปลี่ยนแปลง

ผลลัพธ์:

- ปิด rollout PR #26 สำเร็จ โดย Production คงอยู่ที่ `main@53d886c`
- เหตุรอบเปิดผิดลำดับ โครงงานที่ยังไม่พร้อมส่งหลักฐานหรือนัดสอบได้ ปุ่มค้าง `500/digest` หรือ audit ผิดปกติที่พบภายหลัง ให้เปิดเป็น Production incident ใหม่

## 2026-08-17 - Student Proposal feedback and lifecycle display rollout closeout

ประเภท: Production reliability maintenance

Production:

- URL: `https://system-project-math-sci-sru.vercel.app`
- GitHub main ก่อนปล่อย: `53d886c0c9dcd2679428d0d5c83356d01c178812`
- Final GitHub main: `d3a32a0679febfac4bbf38c891d815f5530dff11`
- Final Vercel deployment: `dpl_2uFnzbvTCXzMR1RAiFJKDwzwLJx2`
- Vercel deployment status: `READY`
- Rollback deployment: `dpl_ork7h6nka6hDgFDbUkCjM6TVFFTk`
- Rollback tag: `prod-before-pr28-20260817-1907`

Patch ที่ปล่อย:

| Patch | PR | Merge commit |
| --- | --- | --- |
| Student Proposal submit feedback and lifecycle display | #28 | `d3a32a0679febfac4bbf38c891d815f5530dff11` |

ผลการทดสอบก่อนปล่อย:

- ผ่าน typecheck, lint, tests `602/602`, production build, `git diff --check` และ secret scan
- Vercel Preview `dpl_9RghCs9Ty2EpmvAtx3eEFR8KEd3L` เป็น `READY` และ read-only browser smoke ผ่าน
- QA ยืนยันการส่ง Proposal ฉบับแก้ไข, การเพิ่ม version เพียงหนึ่งรายการ, คิวตรวจของที่ปรึกษา และ structured outcome log โดยไม่บันทึกเนื้อหา Proposal หรือข้อมูลส่วนบุคคล
- Lifecycle display ครอบคลุมทุก `ProjectStatus` เพียงระยะเดียวและไม่ย้อนลำดับ; `PASS_WITH_REVISION` อยู่ขั้นที่ 7 จาก 14 ก่อนที่ปรึกษารับรอง

ผลการเฝ้าดู Production:

- เฝ้าดูครบอย่างน้อย 60 นาที โดยตรวจทันทีและที่ประมาณนาที 15, 30, 45 และ 60
- Production HTTP ที่ `/` และ `/login` ตอบ HTTP 200
- Read-only Edge smoke แสดงหน้า Admin, Teacher และ Student Proposal route โดยไม่พบ application error, digest หรือ auth failure
- Vercel deployment คงเป็น `READY`; ไม่พบ error-level runtime log หรือ Production `5xx` ตลอด observation window
- Production และ QA Supabase ตอบ read-only `SELECT 1` สำเร็จทุก checkpoint
- GitHub main คงอยู่ที่ merge commit ของ PR #28 และ rollback tag ชี้กลับ Production baseline เดิมตลอดช่วงตรวจ
- ไม่ได้รับรายงานจากผู้ใช้ที่ตรงกับเงื่อนไข rollback

ขอบเขตและความปลอดภัย:

- ไม่มี database migration หรือการเปลี่ยน environment variable
- การตรวจ Production เป็น read-only; ผู้ทดสอบไม่ได้ส่ง Production form หรือแก้ Production database
- ไม่มี rollback และไม่มีการลบหรือแก้ไข audit/evidence history
- Patch เปลี่ยนการแสดงผลและ feedback หลังส่ง ไม่เปลี่ยน lifecycle transition, scoring, auth หรือ eligibility semantics
- GitHub Supabase heartbeat เป็นระบบแยกและไม่ได้ถูกเปลี่ยนแปลง

ผลลัพธ์:

- ปิด rollout PR #28 สำเร็จ โดย Production คงอยู่ที่ `main@d3a32a0`
- เหตุข้อมูลหาย ปุ่มค้าง `500/digest`, auth failure, lifecycle regression, workload mismatch หรือ Student Proposal ใช้งานไม่ได้ที่พบภายหลัง ให้เปิดเป็น Production incident ใหม่

## 2026-08-26 - PR32 teacher score draft recovery rollout closeout

ประเภท: Production reliability maintenance

Production:

- URL: `https://system-project-math-sci-sru.vercel.app`
- GitHub main: `c21965b07e07cf39292c16f87307c73227dfc93d`
- Vercel deployment: `dpl_HVkVWBisSUSUP4x92PwiCEb1Et4f`
- Vercel deployment status: `READY`
- Rollback tag: `prod-before-pr32-20260826-1831` ชี้ไปที่ `013497a1b6d72084794e8b5149118f976485dc34`

Patch ที่ปล่อย:

- PR #32 แก้การกู้คืนร่างคะแนน Proposal ของอาจารย์ โดยไม่ reload หน้าแบบจับเวลา
- เก็บข้อมูล recovery ไว้เมื่อ action ไม่สำเร็จ และล้างเมื่อ Server Action ยืนยันความสำเร็จแล้วเท่านั้น
- รองรับผลสำเร็จหลาย request ด้วย request ID และคงพฤติกรรม idempotent เมื่อ retry ข้อมูลเดิม

ผลการทดสอบและเฝ้าดู:

- QA ทดสอบการบันทึกร่างที่ไม่มีข้อเสนอแนะ, เปิดกลับมาแก้ต่อ และ retry ข้อมูลเดิมสำเร็จ โดยไม่เกิด submission, score item หรือ audit ซ้ำ
- Production ผ่าน observation ครบ 60 นาทีที่ checkpoint ประมาณนาที 15, 30, 45 และ 60
- HTTP แบบ read-only ที่ `/`, `/login`, `/teacher/proposals` และเส้นทาง scoring ทดสอบตอบ HTTP 200 โดยไม่พบ application error
- Vercel ไม่พบ Production `5xx` ในช่วง observation และ deployment/main SHA คงตรงกัน
- Production Supabase `project-course-system` และ QA Supabase `lordtd-hub's project-scoring` เป็น `ACTIVE_HEALTHY`; read-only `SELECT 1` สำเร็จทั้งสองระบบ
- ไม่ได้รับรายงานจากผู้ใช้ที่ตรงกับเงื่อนไข rollback ระหว่าง observation window

ขอบเขตและความปลอดภัย:

- ไม่มี database migration, environment change หรือ Production database mutation
- ผู้ทดสอบไม่ได้ส่ง Production form หรือเปิดเผยคะแนน/ข้อเสนอแนะ
- Fresh `pg_dump` รอบนี้สร้างไม่สำเร็จเพราะ Docker engine ในเครื่องไม่พร้อม; PR32 เป็น code-only และเก็บ deployment เดิมกับ rollback tag ไว้สำหรับย้อนกลับ
- ไม่มีการ rollback และไม่มีการลบหรือแก้ไข audit/evidence history

ผลลัพธ์:

- ปิด rollout PR32 สำเร็จ โดย Production คงอยู่ที่ `main@c21965b`
- เหตุปุ่มค้าง, ร่างคะแนนหาย, 500/digest, auth failure, workload mismatch หรือ lifecycle regression ที่พบภายหลัง ให้เปิดเป็น Production incident ใหม่
