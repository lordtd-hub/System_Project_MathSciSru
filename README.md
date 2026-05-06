# Project Presentation, Feedback & Evidence System — Codex Starter Pack

ชุดไฟล์นี้ใช้สำหรับให้ Codex เริ่มสร้างเว็บแอปประเมินการนำเสนอรายวิชาโครงงานคณิตศาสตร์

## วิธีใช้แบบเร็ว

1. สร้าง Git repository ว่าง
2. แตก zip นี้แล้ว copy ไฟล์ทั้งหมดไปไว้ที่ root ของ repo
3. เปิด Codex ใน folder/repo นี้
4. ให้ Codex อ่านไฟล์เหล่านี้ก่อน:
   - `AGENTS.md`
   - `PROJECT_SPEC.md`
   - `RUBRICS_CHECKLIST.md`
   - `DATA_MODEL_DRAFT.md`
   - `CODEX_TASKS.md`
5. เริ่มสั่งงานจาก `MVP1_CODEX_PROMPT.md` หรือใช้ task ย่อยในโฟลเดอร์ `prompts/`

## แนวทางที่แนะนำ

อย่าสั่ง Codex ให้ทำทั้งระบบในครั้งเดียว ให้ทำตามลำดับนี้:

1. Scaffold project
2. Database + Prisma schema
3. Teacher seed data
4. Student Excel import
5. Google auth + teacher account claim
6. Project origin + proposal submission
7. Proposal checklist scoring
8. Admin proposal decision + feedback release

## ขอบเขต MVP 1

MVP 1 ทำเฉพาะระบบเสนอหัวข้อและการประเมิน Proposal

ยังไม่ทำ:
- Progress 1
- Progress 2
- Final Presentation
- External committee magic link
- AUN-QA export แบบเต็ม
- Report / Article assessment
- Advisor assessment

แต่ database ควรออกแบบเผื่ออนาคตได้

## Stack ที่ต้องการ

- Next.js
- TypeScript
- PostgreSQL
- Prisma ORM
- Tailwind CSS
- Google authentication
- Excel import
- Markdown + LaTeX preview
- Thai UI first

## ไฟล์ในชุดนี้

| File | ใช้ทำอะไร |
|---|---|
| `AGENTS.md` | คำสั่งถาวรให้ Codex |
| `PROJECT_SPEC.md` | requirement หลักของระบบ |
| `MVP1_CODEX_PROMPT.md` | prompt ก้อนใหญ่สำหรับเริ่ม MVP 1 |
| `CODEX_TASKS.md` | task ย่อยสำหรับสั่ง Codex ทีละขั้น |
| `RUBRICS_CHECKLIST.md` | rubric แบบ checklist |
| `DATA_MODEL_DRAFT.md` | draft database / Prisma model |
| `CONFIG_EXAMPLE.yaml` | ตัวอย่าง config ของ assessment |
| `SEED_TEACHERS.csv` | รายชื่ออาจารย์เริ่มต้น |
| `STUDENT_IMPORT_TEMPLATE.csv` | template import นักศึกษา |
| `.env.example` | ตัวอย่าง environment variables |
| `prompts/*.md` | prompt ย่อยราย task |

## หลักสำคัญของระบบ

- ระบบประเมินเฉพาะการนำเสนอ รวม 40%
- นักศึกษา login ด้วย `{student_code}@student.sru.ac.th`
- อาจารย์ login ด้วย `@sru.ac.th`
- อาจารย์ login ครั้งแรกต้องเลือกชื่อใน list แล้วรอ Admin approve
- ทุก submission ต้องแนบ Google Drive / Docs / Classroom link
- รองรับ Markdown + LaTeX แต่ไม่อนุญาต raw HTML
- Rubric ใช้ checklist: ติ๊ก = ได้คะแนน, ไม่ติ๊ก = 0
- Proposal feedback แสดงแบบ anonymous ให้นักศึกษา
- Feedback จากกรรมการชุดเล็กแสดงชื่อกรรมการ
- Advisor ไม่ให้คะแนน presentation แต่เห็น feedback หลังปิดรอบสอบ
- นักศึกษาเห็น feedback หลัง Admin release เท่านั้น
- เก็บ evidence trail สำหรับ AUN-QA
# MVP 1 Implementation Notes

This repository now contains a working MVP 1 scaffold for the Project Presentation, Feedback & Evidence System.

## Setup

```bash
npm install
copy .env.example .env
npm run prisma:migrate -- --name init
npm run prisma:seed
npm run dev
```

ถ้า `npm run dev` ค้างระหว่าง compile route ในเครื่อง local ให้ใช้คำสั่งนี้แทน:

```bash
npm run dev:turbo
```

จากนั้นเปิดเว็บที่ `http://127.0.0.1:3000`

Set `DATABASE_URL`, Google OAuth values, `NEXTAUTH_SECRET`, and `INITIAL_ADMIN_EMAIL` in `.env` before running the database commands.

## Validation

```bash
npm run prisma:format
npm run prisma:validate
npm run typecheck
npm run test
npm run lint
npm run build
```

On this Windows machine, use `cmd /c npm.cmd run ...` if PowerShell blocks `npm.ps1`.

## Implemented MVP 1 Scope

- Next.js + TypeScript + Tailwind CSS app shell
- Prisma schema for MVP 1 and future proposal attempts
- Idempotent teacher and proposal rubric seed script
- Admin course setup, student CSV import, teacher claim review, proposal summary, final decision, and feedback release pages
- Student project origin, proposal submission, timeline, and anonymous feedback pages
- Teacher profile claim and proposal checklist scoring pages
- Service tests for link validation, import validation, scoring, required decision reasons, and proposal summaries
# แผน Deployment สำหรับ Production

ระบบนี้แยกสภาพแวดล้อม local development และ production อย่างชัดเจน ห้ามใช้ฐานข้อมูล `localhost` กับเว็บแอปจริงที่เปิดให้ผู้ใช้งานเข้าใช้งาน

## Development vs Production

| รายการ | Development | Production |
|---|---|---|
| Database location | PostgreSQL ใน Docker หรือเครื่อง local ของผู้พัฒนา | Supabase PostgreSQL แบบ hosted database |
| `DATABASE_URL` | `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/project_assessment?schema=public"` | ใช้ Supabase connection string จริงจาก Supabase Project Settings |
| Who can access it | ผู้พัฒนาบนเครื่อง local เท่านั้น | เว็บแอป production บน Vercel และผู้ดูแลระบบที่ได้รับสิทธิ์ |
| Migration command | `npx prisma migrate dev` หรือ `npm run prisma:migrate` สำหรับสร้าง/ทดลอง migration ระหว่างพัฒนา | `npx prisma migrate deploy` สำหรับ apply migration ที่มีอยู่แล้ว |
| Purpose | ใช้ทดสอบ ฟีเจอร์ MVP และข้อมูลจำลอง | ใช้งานจริง เก็บข้อมูลนักศึกษา อาจารย์ คะแนน feedback และ evidence trail |

## หลักการสำคัญ

1. PostgreSQL ที่รันใน Docker บนเครื่อง local มีไว้สำหรับ development เท่านั้น
2. เว็บแอปจริงต้องไม่ใช้ฐานข้อมูล `localhost` เพราะ `localhost` บน Vercel ไม่ใช่เครื่องของผู้พัฒนาและไม่ใช่ฐานข้อมูล production
3. Production ควรใช้ Supabase PostgreSQL เป็น hosted database
4. Next.js app สามารถ deploy ไปที่ Vercel ได้
5. ค่า production `DATABASE_URL` ต้องมาจาก Supabase connection string และเก็บไว้ใน Vercel Environment Variables
6. ไฟล์ `.env` ในเครื่อง local และ environment variables ของ production ต้องแยกกันเสมอ
7. สำหรับ local development ให้ใช้:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/project_assessment?schema=public"
```

8. สำหรับ production ให้ใช้ Supabase connection string จาก Supabase Project Settings
9. การ migrate production ต้องใช้:

```bash
npx prisma migrate deploy
```

ห้ามใช้ `prisma migrate dev` กับ production เพราะคำสั่งนั้นออกแบบมาสำหรับ development และอาจสร้างหรือแก้ migration ระหว่างรันได้

10. ห้าม commit ไฟล์ `.env` จริงหรือ production secrets เข้า Git โดยเด็ดขาด ให้ commit เฉพาะ `.env.example` ที่ไม่มี secret จริง

## ขั้นตอน Deploy ไป Production แบบแนะนำ

1. สร้าง Supabase project สำหรับระบบนี้
2. คัดลอก Supabase PostgreSQL connection string
3. สร้าง Vercel project จาก repository นี้
4. ตั้งค่า Environment Variables ใน Vercel อย่างน้อย:
   - `DATABASE_URL` เป็น Supabase connection string
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` เป็น URL production ของ Vercel
   - `INITIAL_ADMIN_EMAIL`
5. รัน migration สำหรับ production ด้วย `npx prisma migrate deploy`
6. รัน seed เฉพาะข้อมูลตั้งต้นที่ปลอดภัย เช่น teacher master data และ rubric
7. ตรวจสอบการ login ด้วย Google และ role routing ก่อนเปิดใช้งานจริง

หมายเหตุ: MVP 1 ยังไม่ implement Progress 1, Progress 2, Final Presentation, external committee และ AUN-QA export เต็มรูปแบบ
## เปิดรายวิชาและนำเข้านักศึกษา

สำหรับ production ให้ผู้ดูแลระบบเริ่มที่ `/admin/import-students`:

1. กรอก `ปีการศึกษา` เช่น `2569`
2. เลือก `ภาคเรียน` เป็น `1`, `2` หรือ `summer`
3. กรอกชื่อรายวิชา ถ้าต้องการเปลี่ยนจากค่าเริ่มต้น `Mathematical Project Course`
4. กด `เปิดรายวิชา`
5. เลือก Course Offering ที่เปิดแล้ว แล้วนำเข้า CSV นักศึกษาในรายวิชานั้น

ระบบจะไม่สร้าง Course Offering ซ้ำสำหรับ course title + ปีการศึกษา + ภาคเรียนเดียวกัน และการ import นักศึกษาต้องผูกกับ `CourseOffering` ที่มีอยู่จริงเท่านั้น.

## Local PostgreSQL Development ด้วย Docker

สำหรับการพัฒนาในเครื่อง local ให้ใช้ PostgreSQL ผ่าน Docker เท่านั้น ข้อมูลชุดนี้เป็นข้อมูลพัฒนา ไม่ใช่ฐานข้อมูล production

1. เปิด PostgreSQL local:

```bash
docker compose up -d
```

2. คัดลอกไฟล์ environment ตัวอย่างเป็นไฟล์ local:

```bash
copy .env.example .env
```

3. ตรวจสอบให้ `.env` ใช้ค่า local development นี้:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/project_assessment?schema=public"
```

4. รัน migration สำหรับ local development:

```bash
npx prisma migrate dev
```

หรือใช้ script:

```bash
npm run prisma:migrate -- --name init
```

5. รัน seed ข้อมูลตั้งต้น:

```bash
npm run prisma:seed
```

6. เปิด dev server:

```bash
npm run dev
```

ถ้า `npm run dev` ค้างหรือ compile route ไม่เสร็จในเครื่อง local ให้ใช้คำสั่งที่เสถียรกว่า:

```bash
npm run dev:turbo
```

แล้วเปิดเว็บที่:

```text
http://127.0.0.1:3000
```

หมายเหตุ: อย่า commit ไฟล์ `.env` จริงเข้า Git และอย่าใช้ฐานข้อมูล local นี้กับ production
## UI Smoke Check สำหรับนักพัฒนา

หลังรัน `npm run dev` หรือ `npm run dev:turbo` และเปิด `http://127.0.0.1:3000` ให้ตรวจด้วยตาอย่างน้อย 3 หน้า:

1. เปิด `/dev-login` แล้วเลือกผู้ใช้ทดสอบ
2. เปิด `/admin` และตรวจว่าเห็น dashboard cards, next action, project status overview และ timeline ในรูปแบบ card ที่มีสี/ระยะห่าง ไม่ใช่ลิงก์สีน้ำเงินแบบ browser default
3. เปิด `/student` และตรวจว่าเห็นชื่อผู้ใช้, status badge, lifecycle stepper, next action card และ timeline ที่จัด layout แล้ว
4. เปิด `/teacher` และตรวจว่าเห็น teacher profile card, งานที่ต้องทำ, Proposal tasks และ guidance panel ที่จัด layout แล้ว

ถ้าหน้าดูเหมือน raw HTML ให้ restart dev server เพราะการรัน `next build` ระหว่าง dev server เปิดอยู่สามารถทำให้ไฟล์ CSS ใน `.next` ไม่ตรงกับ dev server ได้.
## Demo/E2E Data Reset

สำหรับข้อมูลตัวอย่างใน local ให้ใช้:

```bash
npm run prisma:seed:demo
```

ถ้ารัน demo seed หรือ E2E lifecycle ซ้ำหลายครั้งแล้ว dashboard มีข้อมูล demo ซ้ำ ให้ reset เฉพาะข้อมูล demo/E2E ที่รู้จัก:

```bash
cmd /c npm.cmd run dev:reset-demo
```

คำสั่งนี้ refuse ทันทีถ้า `DATABASE_URL` ไม่ใช่ local (`localhost` หรือ `127.0.0.1`) และจะล้างเฉพาะ demo students, demo offering, `e2e-lifecycle-course-offering`, และ legacy `e2e-offering-*` เท่านั้น

## Admin Round Management

ผู้ดูแลระบบจัดการรอบสอบระดับรายวิชาได้ที่:

```text
/admin/rounds
```

Flow หลังปิด Proposal คือปิดรอบ Proposal, ตัดสินผลราย project, แต่งตั้ง HEAD/MEMBER, แล้วจึงเปิดรอบ Progress 1 เอง ระบบไม่เปิด Progress 1 อัตโนมัติหลังปิด Proposal.

## การพิมพ์ Markdown และ LaTeX

หมายเหตุเรื่องรอบสอบ: Proposal, Progress 1, Progress 2 และ Final Presentation เป็น course-level batch rounds หนึ่งรายวิชา/ภาคเรียนมีหนึ่ง `AssessmentRound` ต่อ `roundType` เท่านั้น โปรเจคแต่ละรายการใช้ `AssessmentAttempt` และ timeline/history ใต้รอบเดียวกัน ถ้ามีปัญหารายกรณีให้ใช้ exception/override ไม่สร้าง project หรือ round ซ้ำ

ระบบรองรับ Markdown และ LaTeX ในช่องข้อความยาว เช่น abstract, methods, results, feedback และ comments ของอาจารย์

Inline:

```text
$x_{n+1}=f(x_n)$
```

Display:

```text
$$
\lim_{n\to\infty}x_n=L
$$
```

ใช้ได้ในหน้า submit proposal, project origin, schedule/report skeleton, หน้าให้ comment ของอาจารย์ และหน้า feedback ที่นักศึกษาเห็น ข้อความจะแสดงผลด้วย KaTeX และไม่อนุญาตให้ใช้ raw HTML เช่น `<script>` เพื่อความปลอดภัย

เอกสารหรือสไลด์ประกอบยังแนบผ่าน Google Drive / Docs / Classroom ตามเดิม ไม่อัปโหลดไฟล์เข้าระบบใน MVP นี้
## Current implementation status

This repository has moved beyond the original starter/MVP task list. The current baseline is Lifecycle v2 through Admin-only `COMPLETED`.

- Assessment rounds are course-level only: one `AssessmentRound` per `courseOfferingId + roundType`.
- Implemented workflow: real-login pilot auth, teacher claim approval, student roster gating, course-level round management, self-scheduling, Proposal decisions, Progress 1 scoring, Progress 2 scoring, Final Presentation scoring, report approval/revision, Advisor score 25%, and Admin closeout.
- Proposal comments are visible to students with teacher names; raw Proposal scores remain hidden from students.
- Report/article numeric scoring, AUN-QA export, external magic links, and production deployment are not implemented.
- Historical Proposal-only wording later in this README is retained for archive context and should not be used to reduce the current Lifecycle v2 scope.

## Production readiness quick reference

Use these commands before deploying:

```bash
npm install
npm run preflight:production
npx prisma generate
npm run prisma:deploy
npm run build
```

Required production environment variables:

- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_URL` and `NEXTAUTH_URL`
- `AUTH_SECRET` and `NEXTAUTH_SECRET`
- `AUTH_TRUST_HOST=true` on Vercel
- `INITIAL_ADMIN_EMAIL`
- `STUDENT_EMAIL_DOMAIN=student.sru.ac.th`
- `TEACHER_EMAIL_DOMAIN=sru.ac.th`

Google OAuth redirect URIs:

- Local: `http://localhost:3000/api/auth/callback/google`
- Production: `https://<your-production-domain>/api/auth/callback/google`

Production must not run demo reset/seed or E2E lifecycle scripts against real data. Student access comes from the imported roster, and teacher access comes from Admin-approved claims.

### Production baseline seed

หลังจากรัน production migration แล้ว ให้รัน seed ชุดเล็กสำหรับข้อมูลตั้งต้นจริงเท่านั้น:

```bash
npm run seed:production-baseline
```

คำสั่งนี้ทำเฉพาะสิ่งต่อไปนี้:

- upsert teacher profiles จาก `SEED_TEACHERS.csv`
- เติมอีเมลให้ teacher profile ที่มี `is_initial_admin=TRUE` จาก `INITIAL_ADMIN_EMAIL`
- upsert rubric/config ที่จำเป็นสำหรับ Proposal, Progress 1, Progress 2 และ Final Presentation
- ไม่สร้าง demo students, demo projects, E2E data หรือ course/project records
- ไม่ reset database และไม่ลบข้อมูล production

ก่อนรันกับ Supabase production ให้ตั้งค่า environment ในเครื่อง local หรือ shell session โดยไม่ commit secret:

```bash
DATABASE_URL="..."
DIRECT_URL="..."
INITIAL_ADMIN_EMAIL="..."
```

ถ้าใช้งาน Vercel/Supabase จริง ให้ใช้ connection string จาก Supabase Project Settings และใช้คำสั่งนี้หลัง `npm run prisma:deploy` เท่านั้น. ห้ามรัน `npm run prisma:seed:demo`, `npm run dev:reset-demo` หรือ `npm run e2e:lifecycle` กับ production database.
