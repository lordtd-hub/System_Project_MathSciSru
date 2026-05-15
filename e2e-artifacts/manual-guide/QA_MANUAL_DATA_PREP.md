# QA Manual Data Preparation

Status: ACTIVE-PLAN

Purpose: เตรียมข้อมูล QA สำหรับทำคู่มือการใช้งาน 2 บทบาทหลัก (นักศึกษา/อาจารย์) โดยมี admin ใช้หลังฉากเท่านั้น ไม่แตะ production และไม่ลบข้อมูลอาจารย์จริง 11 คน

## Critical correction - teacher identity handling

Do not rename real teacher profiles and do not replace their stored teacher email with `manual.demo.teacherXX@sru.test`.

Correct behavior:

- Teacher dropdown labels must show the real teacher names only.
- `manual.demo.teacherXX@sru.test` is only a QA login identity for taking manuals.
- The QA manual reset/seed script may link a temporary QA `User` to the real teacher profile via `teacher.userId`.
- The script must preserve the existing `Teacher.email` value. If a teacher profile has a real SRU email, it stays there.
- The script must not clear teacher emails during reset.
- The 11 real teacher names remain the source of truth for teacher display.

Canonical teacher master list for the manual QA baseline:

| Name | Department | Real email state |
|---|---|---|
| ผศ.กันญารัตน์ หนูชุม | Mathematics | empty |
| อ.กันยากร อ่อนรักษ์ | Mathematics | empty |
| ผศ.ดร.เกตุกนก หนูดี | Mathematics | empty |
| ผศ.จิราพร เสนจันทร์ | Mathematics | empty |
| อ.ดร.ธนนต์ ก่อเกียรติสกุล | Mathematics | `thanon.kor@sru.ac.th` |
| อ.ศุภชัย ดำคำ | Mathematics | empty |
| ผศ.ดร.สิทธิโชค ทรงสอาด | Mathematics | `sittichoke.son@sru.ac.th` |
| ผศ.สุจารี ดำศรี | Mathematics | empty |
| อ.ดร.อรรถกร ศักดา | Mathematics | empty |
| ผศ.อรวรรณ สืบเสน | Mathematics | empty |
| ผศ.อัญชุลี ณ ตะกั่วทุ่ง | Mathematics | empty |

If the manual QA reset is run, it must preserve this shape: do not invent SRU emails for the empty rows, and do not replace the two real emails with manual QA emails.

## หลักการ

- ทำบน QA เท่านั้น
- ไม่แตะ production
- ไม่ใช้ Google OAuth / อีเมล SRU จริงในขั้นถ่ายคู่มือ
- ใช้ `/qa-login` เพื่อเข้าสู่ระบบสำหรับถ่ายคู่มือ
- เก็บ teacher master data ชื่อจริง 11 คนไว้
- ล้างเฉพาะข้อมูล pilot/demo/transaction เก่าใน QA ก่อนสร้างชุดคู่มือ

## สิ่งที่เพิ่มในรอบนี้

- เพิ่ม QA identity ชุด `MANUAL-DEMO`
- เพิ่ม student สำหรับคู่มือ 3 คน
- เพิ่ม admin สำหรับเตรียมสถานะและขยับรอบหลังฉาก 1 คน
- เพิ่ม teacher login option สำหรับอาจารย์จริง 11 คน โดยใช้ email QA domain `@sru.test`
- หน้า `/qa-login` ในค่าเริ่มต้นแสดงเฉพาะบัญชีชุดคู่มือเท่านั้น เพื่อกันเลือกบัญชี QA/MULTI-PILOT/Legacy เก่าผิดระหว่างถ่ายคู่มือ
- ถ้าจำเป็นต้องเปิดบัญชี pilot เก่ากลับมาทดสอบย้อนหลัง ให้ตั้ง `QA_LOGIN_SHOW_LEGACY_IDENTITIES=1`
- เพิ่มสคริปต์ reset/seed สำหรับ QA manual demo:

```powershell
$env:QA_MANUAL_RESET_CONFIRM='RESET_QA_FOR_MANUAL_GUIDE'
$env:QA_MANUAL_ALLOW_REMOTE_RESET='1'
cmd /c npm.cmd run qa:manual:reset-seed
```

## Guard ของสคริปต์

สคริปต์จะไม่รันถ้า:

- `VERCEL_ENV=production`
- ไม่มี `DATABASE_URL`
- ไม่ตั้ง `QA_MANUAL_RESET_CONFIRM=RESET_QA_FOR_MANUAL_GUIDE`
- เป็น remote database แต่ไม่ตั้ง `QA_MANUAL_ALLOW_REMOTE_RESET=1`

## UTF-8 / Mojibake guard

รอบนี้ล็อกกติกา encoding เพิ่มไว้แล้วเพื่อกันภาษาไทยพัง:

- เพิ่ม `.editorconfig` ให้ source/document ใช้ `charset = utf-8`, `end_of_line = lf`, และมี final newline
- เพิ่ม `.gitattributes` ให้ Git จัดการ text/eol แบบคงที่ และแยก binary artifacts
- เพิ่ม source test `src/app/encodingPolicySource.test.ts` เพื่อตรวจว่า:
  - repository มี UTF-8/LF policy
  - manual demo text ยังเป็นภาษาไทยจริง เช่น `คู่มือการใช้งานระบบประเมินการนำเสนอโครงงาน`
  - CSV export สำคัญมี UTF-8 BOM (`\uFEFF`) และ `charset=utf-8`
- ถ้า PowerShell แสดงภาษาไทยเป็น `เธ...` ให้ตรวจด้วย UTF-8 codepoint หรือเปิดใน editor ที่เป็น UTF-8 ก่อนสรุปว่าไฟล์เสีย เพราะบางครั้งเป็นปัญหา console encoding ไม่ใช่ไฟล์จริง
- ถ้าต้อง export CSV เพื่อเปิดใน Excel ให้ใส่ UTF-8 BOM เสมอ

## ข้อมูลที่จะถูกล้างใน QA

- Students
- Users
- Projects
- Course offerings
- Assessment rounds
- Schedule proposals/approvals
- Assessment submissions
- Presentation submissions/versions
- Proposal votes/results
- Scores
- Report versions/reviews
- Advisor scores
- Committee assignments
- Advisor requests
- Notifications
- Timeline/status history/audit logs
- Teacher records ที่ไม่ใช่ teacher master 11 คน

## ข้อมูลที่ต้องเก็บ

- Teacher master 11 คนจากรายชื่อจริง
- Rubrics / rubric items
- Prisma schema/migrations
- Source code

## ชุดข้อมูลหลัง seed

Course:

- ปีการศึกษา: 2572
- ภาคเรียน: 1
- ชื่อรายวิชา: `คู่มือการใช้งานระบบประเมินการนำเสนอโครงงาน`
- รอบสอบทุก round เริ่มที่ `DRAFT`

Admin:

- `คู่มือ Admin`

Students:

- `คู่มือ Student 01`
- `คู่มือ Student 02`
- `คู่มือ Student 03`

Teachers:

- อาจารย์จริง 11 คนใน dropdown ชุดคู่มือ

Projects:

- สร้าง project ให้ student ทั้ง 3 คนที่สถานะ `STUDENT_PROFILE`
- เหมาะสำหรับถ่ายคู่มือจากจุดเริ่มต้นจริงทีละ step

## ขั้นต่อไปหลัง reset/seed สำหรับคู่มือ 2 บทบาท

1. เปิด QA preview `/qa-login`
2. Login เป็น `คู่มือ Admin`
3. ตรวจว่ามี course/manual offering และ projects 3 รายการ
4. Login เป็น `คู่มือ Student 01`
5. ถ่ายคู่มือนักศึกษา ตั้งแต่ profile/project/proposal/schedule/report/feedback รวมกรณีเสนอวันสอบใหม่และแก้ไขรายงาน
6. Login เป็นอาจารย์ชุดคู่มือ
7. ถ่ายคู่มืออาจารย์: dashboard, advisor request, advicees, schedule approval/rejection, scoring, report review/revision, advisor score
8. Login เป็น admin อีกครั้ง
9. ใช้ admin เฉพาะหลังฉากเพื่อเปิด/ปิดรอบหรือขยับสถานะสำหรับการถ่ายภาพ ไม่ทำคู่มือ admin ในรอบนี้

## หมายเหตุ

คู่มือสุดท้ายควรเขียนเป็นระบบจริง แต่ screenshot มาจาก QA เนื่องจาก production ใช้ Google OAuth/เมล SRU จริง
