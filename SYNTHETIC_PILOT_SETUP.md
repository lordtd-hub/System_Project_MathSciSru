# คู่มือเตรียม Synthetic Pilot ด้วยบัญชี ADMIN • TEACHER และ STUDENT 1 บัญชี

## 1. วัตถุประสงค์

เอกสารนี้ใช้เตรียมการทดสอบ pilot ภายในเมื่อยังไม่มีผู้ใช้จริง โดยใช้บัญชีจำนวนน้อยที่สุดแต่ยังเดิน workflow จริงผ่าน UI, route guard, permission, server action, lifecycle และ evidence trail ตามระบบ production

เป้าหมายคือทดสอบแบบสมจริงตั้งแต่ student profile จนถึง Admin closeout เป็น `COMPLETED` และตรวจ export หลักฐาน CSV/XLSX โดยไม่สร้าง shortcut ที่ข้ามขั้นตอน workflow

## 2. หลักการสำคัญ

- ใช้ Google OAuth จริงบน production
- ไม่ใช้ dev-login บน production
- ไม่แก้ฐานข้อมูลตรง ยกเว้นกรณีเตรียม roster/course offering ผ่านเครื่องมือ Admin ที่มีอยู่
- ไม่ bypass approval, scoring, report review, advisor score หรือ closeout
- ใช้บัญชี ADMIN • TEACHER สำหรับบทบาทผู้ดูแลระบบและอาจารย์
- ใช้บัญชี STUDENT แยกต่างหากสำหรับ workflow ของนักศึกษา
- ข้อมูลทดสอบต้องตั้งชื่อให้ชัดว่าเป็น synthetic pilot เพื่อไม่ปนกับข้อมูลจริง

## 3. บัญชีที่ใช้

| บัญชี | รูปแบบที่แนะนำ | ใช้ทำอะไร | ข้อควรระวัง |
|---|---|---|---|
| Main ADMIN • TEACHER | อีเมล `@sru.ac.th` ที่ตั้งเป็น Admin และผูกกับ Teacher profile แล้ว | เข้า `/admin` และ `/teacher` | ห้ามใช้แทนนักศึกษา |
| Dedicated STUDENT | `{student_code}@student.sru.ac.th` | เข้า `/student` และเดิน workflow นักศึกษา | ต้อง import roster ด้วย `student_code` ที่ตรงกับ prefix อีเมล |

ตัวอย่าง student test account:

```text
student_code: 9999999999
email: 9999999999@student.sru.ac.th
first_name_th: ทดสอบ
last_name_th: ระบบ
```

ให้ปรับ `student_code` ให้ตรงกับบัญชี Google ที่ใช้งานได้จริงในโดเมน `student.sru.ac.th`

## 4. ผลการตรวจ capability ปัจจุบัน

ระบบรองรับ ADMIN • TEACHER โดยใช้ capability ปกติ:

- `ADMIN` เข้า `/admin` ได้ตาม guard ของ Admin
- Admin ที่มี `teacherId` และ effective role รวม `TEACHER` เข้า `/teacher` ได้ผ่าน `hasApprovedTeacherCapability()`
- `PENDING_TEACHER` ยังเข้า scoring/student data ไม่ได้ และเห็นเฉพาะ claim/pending flow
- Student ต้องมี roster/imported student ที่ตรงกับ Google email จึงเข้า workflow student ได้
- Route `/admin` และ `/teacher` ยังใช้ guard ปกติ ไม่ได้ bypass permission

สรุป: ใช้บัญชี ADMIN • TEACHER เดียวสำหรับ Admin และ Teacher ได้อย่างปลอดภัยสำหรับ synthetic pilot ถ้าบัญชีนั้นผูกกับ Teacher profile ที่ active แล้ว

## 5. Required Environment Checks

ก่อนเริ่มให้ตรวจรายการนี้:

| รายการ | Expected | Pass/Fail |
|---|---|---|
| Production deployment Ready | Vercel Production เป็น Ready | |
| Function region | Vercel Functions อยู่ `sin1` ถ้า Supabase อยู่ Singapore | |
| Google OAuth | login ผ่าน production ได้ | |
| `ENABLE_ADMIN_TEST_TOOLS` | ปิดก่อนข้อมูลจริง หรือเปิดเฉพาะช่วงล้างข้อมูลทดสอบที่ตั้งใจ | |
| Admin account | เข้า `/admin` ได้ | |
| Teacher capability | บัญชีเดียวกันเข้า `/teacher` ได้ | |
| Student account | Google account นักศึกษาทดสอบเข้าได้ | |
| Course offering | มี course offering สำหรับ synthetic pilot | |
| Rubric baseline | Proposal, Progress 1, Progress 2, Final rubric พร้อมใช้งาน | |
| Evidence module | `/admin/evidence` เข้าได้เฉพาะ Admin | |

## 6. การเตรียมบัญชี ADMIN • TEACHER

1. Login ด้วยบัญชีหลัก `@sru.ac.th`
2. เข้า `/admin`
3. ตรวจว่า dashboard แสดงเมนู Admin ปกติ
4. ตรวจ role switch/header ว่ามีทางเข้า Teacher
5. เข้า `/teacher`
6. ถ้าเห็นหน้า claim หรือ pending:
   - เลือก Teacher profile ที่ตรงกับบัญชี
   - กลับไป Admin ด้วยบัญชี Admin ที่มีสิทธิ์
   - อนุมัติ teacher claim ที่ `/admin/claims`
   - logout/login ใหม่ แล้วตรวจ `/teacher` อีกครั้ง
7. ถ้าเข้า `/teacher` ได้ แปลว่าบัญชีพร้อมใช้เป็น ADMIN • TEACHER

ห้ามแก้ role ตรงใน database เพื่อให้ได้สิทธิ์ Teacher ถ้ายังไม่จำเป็น เพราะจะทำให้ pilot ไม่สะท้อน workflow จริง

## 7. การเตรียม STUDENT Test Account

วิธีที่แนะนำที่สุดคือใช้ Google account จริงในโดเมน `student.sru.ac.th`

1. เลือกบัญชี student test ที่เข้า Google ได้จริง เช่น:

```text
9999999999@student.sru.ac.th
```

2. เตรียมไฟล์ roster CSV สำหรับ import:

```csv
student_code,first_name_th,last_name_th
9999999999,ทดสอบ,ระบบ
```

3. Admin เข้า `/admin/import-students`
4. เลือก course offering สำหรับ synthetic pilot
5. import roster ที่มีนักศึกษา test เพียง 1 คน
6. ตรวจที่ `/admin/students` ว่านักศึกษาปรากฏในรายวิชา
7. Login ด้วยบัญชี student test
8. เข้า `/student`
9. ต้องไม่เห็น `/admin` หรือ `/teacher` เป็นสิทธิ์ใช้งาน

ถ้าไม่มีบัญชี Google นักศึกษาจริง ให้ทดสอบส่วน student ใน environment ที่อนุญาต dev-login เท่านั้น ไม่ควรใช้วิธี fake session บน production

## 8. การเตรียม Course Offering

1. ใช้ Admin ตรวจ course offering ปัจจุบัน
2. ถ้าต้องสร้างใหม่ ให้ตั้งชื่อ/ภาคเรียนให้เห็นชัดว่าเป็น synthetic pilot เช่น:

```text
ภาคเรียนที่ 1 ปีการศึกษา 2568 - Synthetic Pilot
```

3. Import student test เข้ารายวิชานี้
4. ตรวจว่าไม่มี roster จริงปนกับ synthetic pilot
5. ถ้า `ENABLE_ADMIN_TEST_TOOLS=1` เปิดอยู่ ให้ใช้เฉพาะก่อนเริ่มเพื่อ reset ข้อมูลทดสอบ และปิดก่อนใช้กับข้อมูลจริง

## 9. การเตรียม Rubric

1. ตรวจว่า rubric baseline ถูก seed แล้ว
2. ต้องมี rubric สำหรับ:
   - Proposal
   - Progress 1
   - Progress 2
   - Final Presentation
3. ไม่แก้คะแนน rubric ระหว่าง synthetic pilot เว้นแต่ตั้งใจทดสอบเรื่อง rubric โดยเฉพาะ

## 10. Pilot Project ที่ใช้ทดสอบ

แนะนำหัวข้อ synthetic:

```text
การทดสอบระบบจัดการโครงงานคณิตศาสตร์สำหรับ Synthetic Pilot
```

ลิงก์หลักฐานให้ใช้ Google Drive/Docs/Classroom ที่เปิดได้จริง และควรตั้งชื่อเอกสารชัดเจน เช่น:

```text
SYNTHETIC-PILOT-9999999999-Proposal
SYNTHETIC-PILOT-9999999999-Progress1
SYNTHETIC-PILOT-9999999999-Report
```

## 11. Exact Workflow to Test

### 11.1 Student Profile

ผู้ใช้: STUDENT  
หน้า: `/student/profile`

สิ่งที่ทำ:
- กรอกข้อมูลส่วนตัวให้ครบ
- บันทึก/ยืนยันข้อมูล

Expected status:
- จาก `STUDENT_PROFILE` ไป `DRAFT`

Expected evidence:
- status history
- timeline event ของการกรอก profile หรือการเริ่ม workflow ถ้าระบบมีบันทึก

Pass/Fail:

| Expected | Actual | Pass/Fail | Notes |
|---|---|---|---|
| Student dashboard ไปขั้น draft ได้ | | | |

### 11.2 Draft / Origin

ผู้ใช้: STUDENT  
หน้า: `/student/origin` หรือ `/student/project`

สิ่งที่ทำ:
- กรอก Project Origin
- เลือก/ระบุอาจารย์ที่ปรึกษา
- ใส่ material link ที่เป็น Google Drive/Docs/Classroom
- ยอมรับ declaration
- submit

Expected status:
- `DRAFT` ไป `PENDING_ADVISOR`

Expected evidence:
- `ProjectOriginVersion`
- `ProjectTimelineEvent`
- `ProjectStatusHistory`

### 11.3 Advisor Request

ผู้ใช้: ADMIN • TEACHER ในบทบาท Teacher  
หน้า: `/teacher/advisor-requests`

สิ่งที่ทำ:
- เปิดคำขอที่ปรึกษาของนักศึกษา test
- approve advisor request

Expected status:
- `PENDING_ADVISOR` ไป `PENDING_ADMIN`

Expected evidence:
- advisor request decision
- timeline event
- status history

### 11.4 Admin Approval

ผู้ใช้: ADMIN • TEACHER ในบทบาท Admin  
หน้า: `/admin`

สิ่งที่ทำ:
- ยืนยัน project และ advisor

Expected status:
- `PENDING_ADMIN` ไป `PROPOSAL_PENDING`

Expected evidence:
- Admin confirmation timeline
- audit log ถ้ามีใน action
- status history

### 11.5 Proposal Submission

ผู้ใช้: STUDENT  
หน้า: `/student/proposal`

สิ่งที่ทำ:
- กรอกข้อมูล proposal
- ใส่ Markdown/LaTeX สั้น ๆ เช่น `$x^2+y^2=z^2$`
- ใส่ material link
- submit

Expected status:
- อยู่ใน proposal workflow และพร้อมให้ Admin เปิดรอบ Proposal ตามเงื่อนไขระบบ

Expected evidence:
- `PresentationSubmissionVersion`
- timeline event

### 11.6 Proposal Scoring

ผู้ใช้: ADMIN • TEACHER ในบทบาท Admin และ Teacher  
หน้าที่ใช้:
- `/admin/rounds` หรือ `/admin`
- `/teacher/proposals`
- `/teacher/scoring/[assignmentId]`
- `/admin/proposals`

สิ่งที่ทำ:
1. Admin เปิดรอบ Proposal ถ้ายังไม่เปิด
2. Teacher ทำ proposal scoring
3. เลือก vote เช่น `PASS`
4. Admin ตรวจ summary
5. Admin ตัดสินผลสุดท้ายเป็น `PASS`

Expected status:
- `PROPOSAL_REVIEW`
- `PROPOSAL_ADMIN_DECISION`
- `TOPIC_APPROVED`

Expected evidence:
- assessment round
- assessment attempt
- evaluator assignment
- score submission
- score items
- proposal vote
- proposal result
- timeline/status history/audit log

### 11.7 Committee Assignment

ผู้ใช้: ADMIN  
หน้า: `/admin/committee`

สิ่งที่ทำ:
- แต่งตั้ง advisor/head/member ให้ครบตาม UI
- สำหรับ synthetic pilot อาจใช้ Teacher account เดียวได้เฉพาะถ้าระบบอนุญาตตาม validation ปัจจุบัน
- ถ้าระบบบังคับหลายคน ให้ใช้ teacher profiles ที่มีอยู่ตาม rule จริง

Expected status:
- จาก `TOPIC_APPROVED` ไปพร้อมเข้าสู่ workflow ถัดไปตามระบบ

Expected evidence:
- committee assignments
- timeline/audit log

### 11.8 Progress 1 Scoring

ผู้ใช้: ADMIN, STUDENT, TEACHER  
หน้าที่ใช้:
- `/admin/rounds`
- `/student/schedule`
- `/teacher/schedules`
- `/teacher/progress1`

สิ่งที่ทำ:
1. Admin เปิดรอบ Progress 1 เมื่อระบบบอกว่าพร้อม
2. Student เสนอตารางสอบ/หลักฐาน Progress 1
3. Teacher/Admin ตรวจ/อนุมัติ schedule ตาม flow ที่ระบบมี
4. Teacher บันทึกคะแนน Progress 1

Expected evidence:
- course-level `AssessmentRound` สำหรับ `PROGRESS_1`
- schedule proposal/approval
- score submission
- score items
- timeline/status history

### 11.9 Progress 2 Scoring

ผู้ใช้: ADMIN, STUDENT, TEACHER  
หน้าที่ใช้:
- `/admin/rounds`
- `/student/schedule`
- `/teacher/schedules`
- `/teacher/progress2`

สิ่งที่ทำ:
- ทำ pattern เดียวกับ Progress 1 สำหรับ `PROGRESS_2`

Expected evidence:
- course-level `AssessmentRound` สำหรับ `PROGRESS_2`
- schedule/evaluation evidence
- score submission

### 11.10 Final Presentation Scoring

ผู้ใช้: ADMIN, STUDENT, TEACHER  
หน้าที่ใช้:
- `/admin/rounds`
- `/student/schedule`
- `/teacher/final`

สิ่งที่ทำ:
- เปิด Final Presentation round
- Student เสนอ schedule/material
- Teacher ให้คะแนน Final Presentation

Expected status:
- เมื่อหลักฐานครบ ระบบเข้าสู่ขั้นหลัง Final ตาม workflow ปัจจุบัน

Expected evidence:
- course-level `AssessmentRound` สำหรับ `FINAL_PRESENTATION`
- schedule/evaluation evidence
- score submission

### 11.11 Report Review

ผู้ใช้: STUDENT, TEACHER  
หน้าที่ใช้:
- `/student/report`
- `/teacher/reports`

สิ่งที่ทำ:
1. Student ส่ง report version พร้อม Google Drive link
2. Teacher reviewer ให้ `PASS` หรือ `FAIL`
3. ถ้า `FAIL` ให้ Student ส่ง version ใหม่
4. ให้ reviewer ที่จำเป็นทุกคน `PASS`

Expected status:
- `REPORT_REVIEW`
- `REPORT_APPROVED`

Expected evidence:
- `ReportVersion`
- `ReportReview`
- timeline event
- status history

### 11.12 Advisor Score

ผู้ใช้: ADMIN • TEACHER ในบทบาท Teacher/Advisor  
หน้า: `/teacher/advisor-score`

สิ่งที่ทำ:
- หลัง report approved ให้ advisor submit Advisor score

Expected status:
- `REPORT_APPROVED` ไป `ADVISOR_SCORING`

Expected evidence:
- `AdvisorScore`
- timeline/status history

### 11.13 Admin Closeout

ผู้ใช้: ADMIN  
หน้า: `/admin/closeout`

สิ่งที่ทำ:
- ตรวจ eligibility
- กด closeout/mark completed

Expected status:
- `ADVISOR_SCORING` ไป `COMPLETED`

Expected evidence:
- `ProjectStatusHistory`
- `ProjectTimelineEvent`
- `AuditLog`

## 12. Evidence & Export Checks

ผู้ใช้: ADMIN  
หน้า: `/admin/evidence`

สิ่งที่ตรวจ:
- course offering ถูกต้อง
- project test ปรากฏใน table
- evidence completeness แสดงตามหลักฐานที่ทำจริง
- missing evidence ต้องไม่ถูกซ่อน
- recent timeline/audit แสดงข้อมูลที่เกี่ยวข้อง

Export ที่ต้องทดสอบ:

| Export | CSV | XLSX | ตรวจอะไร |
|---|---|---|---|
| project evidence completeness | | | มี project test, สถานะ, หลักฐานครบ/ไม่ครบถูกต้อง |
| timeline events | | | ลำดับเวลาและข้อความอ่านได้ |
| score/rubric evidence | | | score submission และ rubric/round evidence ถูกต้อง |
| report review evidence | | | report version/review decision ตรง workflow |
| global audit logs | | | label ชัดว่าเป็น global audit export |

ให้เปิดไฟล์ใน Excel และตรวจ:
- ภาษาไทยอ่านได้
- header ชัดเจน
- filename มีวันที่
- ไม่มีสูตร Excel ทำงานจากข้อความ test ที่ขึ้นต้นด้วย `=`, `+`, `-`, `@`

## 13. Mobile Checks

ตรวจอย่างน้อย:

| Role | Page | Expected | Pass/Fail |
|---|---|---|---|
| Admin | `/admin` | action queue อ่านง่าย, ปุ่มไม่ล้น | |
| Teacher | `/teacher` | work queue ใช้งานได้, เข้า scoring page ได้ | |
| Student | `/student` | next action ชัดเจน | |
| Student | form pages | กรอก/submit ได้ แต่ scoring/export ควรทำบน desktop | |

## 14. Common Mistakes

- ใช้บัญชี ADMIN • TEACHER แทน Student ทำให้ไม่ได้ทดสอบ student guard จริง
- import student_code ไม่ตรงกับ prefix ของอีเมล Google
- ใช้ลิงก์ที่ไม่ใช่ `drive.google.com`, `docs.google.com`, หรือ `classroom.google.com`
- ลืมเปิด course-level round ก่อน scoring
- ใช้ course offering ผิด ทำให้ evidence/export ดูเหมือนข้อมูลหาย
- แต่งตั้งกรรมการไม่ครบ ทำให้ Progress/Report/Closeout ไม่พร้อม
- ลืมให้ reviewer ทุกคน pass report
- ลืม advisor score ก่อน Admin closeout
- เปิด `ENABLE_ADMIN_TEST_TOOLS=1` ค้างไว้บน production ช่วงใช้งานจริง

## 15. Cleanup Guidance

ก่อน cleanup:

1. Export evidence CSV/XLSX เก็บไว้ก่อน
2. บันทึก issue log และ screenshot ที่จำเป็น
3. ตรวจว่า project เป็น synthetic pilot จริง ไม่ใช่ข้อมูล pilot จริง

วิธี cleanup ที่แนะนำ:

- ถ้าเป็นช่วงก่อนใช้จริงและเปิด test tools ตั้งใจไว้ ให้ใช้เครื่องมือ reset ที่ Admin dashboard สำหรับ course offering test
- ถ้าเริ่มมีข้อมูลจริงแล้ว ห้ามล้างข้อมูลทั้ง course offering โดยไม่ยืนยันกับทีม
- หลีกเลี่ยงการลบตรงใน database
- ถ้าจำเป็นต้องแก้ database ให้ export evidence และจดเหตุผล/ผู้อนุมัติไว้ก่อน

## 16. Final Synthetic Pilot Checklist

| รายการ | Pass/Fail | Notes |
|---|---|---|
| ADMIN login ได้ | | |
| ADMIN เข้า `/admin` ได้ | | |
| บัญชีเดียวกันเข้า `/teacher` ได้ | | |
| STUDENT login ได้ด้วยบัญชีแยก | | |
| STUDENT ไม่เห็นสิทธิ์ Admin/Teacher | | |
| course offering พร้อม | | |
| roster มี student test 1 คน | | |
| rubric พร้อม | | |
| student profile ผ่าน | | |
| origin/advisor request ผ่าน | | |
| advisor approval ผ่าน | | |
| admin approval ผ่าน | | |
| proposal submission/scoring/decision ผ่าน | | |
| committee assignment ผ่าน | | |
| Progress 1 score ผ่าน | | |
| Progress 2 score ผ่าน | | |
| Final score ผ่าน | | |
| report review ผ่าน | | |
| advisor score ผ่าน | | |
| Admin closeout เป็น `COMPLETED` | | |
| Evidence dashboard แสดงข้อมูล | | |
| CSV export เปิดใน Excel ได้ | | |
| XLSX export เปิดใน Excel ได้ | | |
| mobile smoke test ผ่าน | | |

## 17. Go / No-Go สำหรับ Synthetic Pilot

Go เมื่อ:

- ทั้งสองบัญชี login ได้จริง
- ADMIN • TEACHER เข้า `/admin` และ `/teacher` ได้โดย guard ปกติ
- STUDENT แยกบัญชีและไม่เห็นสิทธิ์อื่น
- workflow เดินถึง `COMPLETED`
- evidence/export ตรวจแล้วตรงกับข้อมูลที่ทำจริง

No-Go เมื่อ:

- ต้องแก้ database ตรงเพื่อข้ามสถานะ
- student account เข้าไม่ได้ด้วย Google OAuth
- course offering/roster ปนกับข้อมูลจริงจนแยกไม่ออก
- evidence export ขาดหลักฐานสำคัญ
- workflow ใดต้อง bypass permission เพื่อเดินต่อ
