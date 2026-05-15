# Manual Capture Plan

Status: ACTIVE-PLAN

Purpose: แผนถ่ายคู่มือการใช้งาน 2 บทบาทจาก QA manual demo data

## Scope

คู่มือที่จะทำ:

1. คู่มือนักศึกษา
2. คู่มืออาจารย์

คู่มือรอบนี้รวมเฉพาะงานที่ผู้ใช้ต้องเจอในการใช้งานจริง:

- เส้นทางปกติจนจบรายวิชา
- กรณีเสนอวันสอบใหม่หลังถูกปฏิเสธ
- กรณีส่งรายงานฉบับใหม่หลังอาจารย์ขอแก้ไข

ยังไม่รวม:

- คู่มือผู้ดูแลระบบ
- งานสาย
- late/reopen/recovery
- การตั้งค่าระบบหรือจัดการรายวิชา

Environment:

- QA preview เท่านั้น
- `/qa-login` ใช้เพื่อสลับบทบาทตอนถ่ายภาพเท่านั้น
- manual demo identities
- ไม่แตะ production
- Classic/current production-like UI เท่านั้น

## คู่มือนักศึกษา

Persona:

- Student 01: เส้นทางปกติ
- Student 02: กรณีรายงานถูกขอแก้ไข แล้วส่งรายงานฉบับใหม่
- Student 03: กรณีวันสอบถูกปฏิเสธ แล้วเสนอวันสอบใหม่

ลำดับถ่าย:

1. Dashboard นักศึกษาหลังเข้าสู่ระบบ
2. กรอกข้อมูลนักศึกษาและข้อมูลโครงงาน
3. ขออาจารย์ที่ปรึกษา
4. ส่งข้อมูล Proposal
5. เสนอวันสอบ
6. อ่านเหตุผลเมื่อวันสอบถูกปฏิเสธ
7. แก้ไขและเสนอวันสอบใหม่
8. ส่งหลักฐาน Progress 1
9. ดูผลและข้อเสนอแนะ Progress 1
10. ส่งหลักฐาน Progress 2
11. ส่งหลักฐาน Final
12. ส่งรายงานฉบับแรก
13. อ่านคอมเมนต์เมื่ออาจารย์ขอแก้ไขรายงาน
14. ส่งรายงานฉบับใหม่
15. ดูแฟ้มโครงงานและสถานะเสร็จสิ้น

Screenshot filenames:

- `public/manual/screenshots/student/student-01-dashboard.png`
- `public/manual/screenshots/student/student-02-project-form.png`
- `public/manual/screenshots/student/student-03-advisor-request.png`
- `public/manual/screenshots/student/student-04-proposal-submit.png`
- `public/manual/screenshots/student/student-04-work-plan-week-selector.png`
- `public/manual/screenshots/student/student-04-work-plan-export-preview.png`
- `public/manual/screenshots/student/student-05-schedule-submit.png`
- `public/manual/screenshots/student/student-06-schedule-rejected.png`
- `public/manual/screenshots/student/student-07-schedule-resubmit.png`
- `public/manual/screenshots/student/student-08-progress1-submit.png`
- `public/manual/screenshots/student/student-09-progress-feedback.png`
- `public/manual/screenshots/student/student-10-final-submit.png`
- `public/manual/screenshots/student/student-11-report-submit-v1.png`
- `public/manual/screenshots/student/student-12-report-revision-comment.png`
- `public/manual/screenshots/student/student-13-report-submit-v2.png`
- `public/manual/screenshots/student/student-14-completed-or-project-record.png`

## คู่มืออาจารย์

Personas:

- Teacher advisor: อาจารย์ที่ปรึกษา ดูลูกศิษย์ ตรวจรายงาน และให้คะแนนที่ปรึกษา
- Teacher committee/chair: อาจารย์ผู้เกี่ยวข้องกับการอนุมัติวันสอบและประเมินรอบนำเสนอ

ลำดับถ่าย:

1. Dashboard อาจารย์
2. อนุมัติคำขอเป็นอาจารย์ที่ปรึกษา
3. ดูหน้าลูกศิษย์ที่ปรึกษาและแฟ้มโครงงาน
4. ตรวจตารางสอบ
5. ปฏิเสธตารางสอบพร้อมเหตุผล
6. อนุมัติตารางสอบที่นักศึกษาเสนอใหม่
7. ประเมิน Proposal หลังการนำเสนอและซักถาม
8. ประเมิน Progress 1 / Progress 2
9. ประเมิน Final
10. ตรวจรายงาน
11. ขอแก้ไขรายงานพร้อมคอมเมนต์
12. อนุมัติรายงานฉบับล่าสุดหลังนักศึกษาส่งใหม่
13. บันทึกคะแนนอาจารย์ที่ปรึกษา
14. ดูแฟ้มโครงงานและหลักฐานย้อนหลัง

Screenshot filenames:

- `public/manual/screenshots/teacher/teacher-01-dashboard.png`
- `public/manual/screenshots/teacher/teacher-02-advisor-request.png`
- `public/manual/screenshots/teacher/teacher-03-advicees.png`
- `public/manual/screenshots/teacher/teacher-04-schedule-review.png`
- `public/manual/screenshots/teacher/teacher-05-schedule-reject.png`
- `public/manual/screenshots/teacher/teacher-06-schedule-approve-resubmitted.png`
- `public/manual/screenshots/teacher/teacher-07-proposal-scoring.png`
- `public/manual/screenshots/teacher/teacher-08-progress-scoring.png`
- `public/manual/screenshots/teacher/teacher-09-final-scoring.png`
- `public/manual/screenshots/teacher/teacher-10-report-review.png`
- `public/manual/screenshots/teacher/teacher-11-report-request-revision.png`
- `public/manual/screenshots/teacher/teacher-12-report-approve-latest.png`
- `public/manual/screenshots/teacher/teacher-13-advisor-score.png`
- `public/manual/screenshots/teacher/teacher-14-project-record.png`

## Screenshot Rules

- ไม่ถ่ายหน้า `/qa-login` ลงคู่มือผู้ใช้งานจริง
- ภาพคู่มือเริ่มหลังเข้าสู่ระบบแล้ว เช่น dashboard ของนักศึกษา หรือ dashboard ของอาจารย์
- ถ่ายเฉพาะส่วนสำคัญของหน้าจอ ไม่จำเป็นต้องถ่ายเต็มหน้าทุกภาพ
- หลีกเลี่ยง secret, token, และ URL ที่มีข้อมูลลับ
- ใช้ชื่อไฟล์ตามรายการด้านบนเพื่อให้หน้า `/manual` แสดงภาพได้อัตโนมัติ
- ถ้ายังไม่มีไฟล์ภาพ หน้า manual จะแสดง placeholder พร้อม path ที่ต้องนำภาพมาวาง

## HTML Manual Output

หน้าคู่มือในแอป:

- `/manual`
- `/manual/student`
- `/manual/teacher`

Source:

- `src/app/manual/page.tsx`
- `src/app/manual/student/page.tsx`
- `src/app/manual/teacher/page.tsx`
- `src/app/manual/manualContent.ts`
- `src/app/manual/ManualGuidePage.tsx`
- `src/app/manual/ManualScreenshot.tsx`

## UTF-8 / Mojibake Guard

- ทุกไฟล์คู่มือและ artifact ต้องบันทึกเป็น UTF-8
- อย่าใช้ shell write trick ที่อาจทำให้ภาษาไทยเพี้ยน
- หาก PowerShell แสดงภาษาไทยผิด ให้ตรวจด้วย editor/UTF-8 ก่อนสรุปว่าไฟล์เสีย
- หาก export คู่มือหรือ CSV ในอนาคต ให้ระบุ `charset=utf-8` และใช้ BOM สำหรับ CSV ที่เปิดใน Excel

## Validation

หลังเพิ่ม/แก้คู่มือ:

```powershell
cmd /c npm.cmd run typecheck
cmd /c npm.cmd test
cmd /c npm.cmd run build
```

หลังถ่ายภาพ:

- เปิด `/manual/student`
- เปิด `/manual/teacher`
- ตรวจว่าไม่มี placeholder เหลือสำหรับภาพที่ต้องใช้จริง
- ตรวจ mobile width ประมาณ 390px ว่าอ่านคู่มือได้
