# คู่มือการใช้งาน Pilot

ระบบบริหารจัดการรายวิชาโครงงานคณิตศาสตร์ / สถิติ  
Project Presentation, Feedback & Evidence System

เอกสารฉบับนี้จัดทำสำหรับการใช้งานระบบจริงในช่วง pilot โดยเน้นขั้นตอนปฏิบัติงานของผู้ดูแลระบบ อาจารย์ นักศึกษา และผู้รับผิดชอบงานประกันคุณภาพหลักสูตร

> หมายเหตุ: คู่มือนี้อธิบายสถานะระบบ ณ ช่วงเริ่ม pilot เท่านั้น หากมีการเปลี่ยน workflow, rubric, สิทธิ์ผู้ใช้ หรือ production URL ให้ปรับปรุงคู่มือนี้ก่อนนำไปใช้กับผู้ใช้งานจริง

## 1. ภาพรวมระบบ

ระบบนี้ใช้สำหรับบริหาร workflow รายวิชาโครงงาน ตั้งแต่การเริ่มต้นหัวข้อ การขออาจารย์ที่ปรึกษา การประเมินการนำเสนอ Proposal / Progress / Final การตรวจรายงาน การให้คะแนน Advisor score และการปิดงานโดยผู้ดูแลระบบ พร้อมเก็บหลักฐานสำหรับติดตามงานและสนับสนุนงาน QA/AUN-QA

### ระบบนี้ใช้ทำอะไร

| งาน | คำอธิบาย |
| --- | --- |
| จัดการรายวิชา | สร้าง course offering ตามภาคเรียนและปีการศึกษา |
| จัดการนักศึกษา | นำเข้ารายชื่อนักศึกษาจาก roster |
| จัดการอาจารย์ | จัดการ teacher profile และอนุมัติ teacher claim |
| เดิน workflow โครงงาน | ติดตามสถานะตั้งแต่ student profile ถึง completed |
| ประเมิน presentation | ใช้ checklist/rubric scoring สำหรับ Proposal, Progress 1, Progress 2, Final |
| ตรวจรายงาน | เก็บหลักฐาน report version และ report review |
| ให้ Advisor score | บันทึกคะแนน Advisor score 25% |
| เก็บหลักฐาน | เก็บ timeline, status history, audit log, score evidence, report evidence |
| ส่งออกหลักฐาน | Export CSV และ Excel (.xlsx) สำหรับงาน QA/AUN-QA |

### บทบาทผู้ใช้

| บทบาท | ใช้โดย | ภาพรวมหน้าที่ |
| --- | --- | --- |
| ADMIN | เจ้าหน้าที่/ผู้ดูแลรายวิชา | ตั้งค่าระบบ อนุมัติ claim จัดการรอบสอบ ตัดสิน Proposal ปิดงาน Export evidence |
| TEACHER | อาจารย์ที่ปรึกษา/กรรมการ | ตอบรับ advisor request ให้คะแนน presentation ตรวจรายงาน ให้ Advisor score |
| STUDENT | นักศึกษา | กรอกข้อมูล ส่งหัวข้อ เลือกที่ปรึกษา ส่งหลักฐาน ดูสถานะและ feedback |
| PENDING_TEACHER | อาจารย์ที่ login แล้วแต่ยังไม่อนุมัติ claim | รอ Admin อนุมัติการผูกบัญชีอาจารย์ |
| ADMIN • TEACHER | ผู้ใช้ที่มีสองบทบาท | ทำงานได้ทั้งฝั่ง Admin และ Teacher ตามสิทธิ์ที่ระบบกำหนด |

### ขอบเขตของ pilot

Pilot นี้ควรเริ่มจากรายวิชาเดียว กลุ่มนักศึกษาขนาดเล็ก และอาจารย์จำนวนจำกัด เพื่อทดสอบ workflow เต็มเส้นทางก่อนเปิดใช้กับทั้งรายวิชา

ขอบเขตที่แนะนำ:

- เริ่มทดสอบด้วยนักศึกษา 1-3 คน
- ใช้ข้อมูลอาจารย์จริงเฉพาะกลุ่ม pilot
- ใช้ course offering จริงหรือ course offering pilot ที่ระบุชัดเจน
- เดิน workflow ให้ครบอย่างน้อย 1 project ตั้งแต่ profile ถึง completed
- Export evidence หลังจบแต่ละรอบสำคัญ

### สิ่งที่ระบบทำได้แล้ว

- Login ด้วย Google OAuth ใน production
- แยกสิทธิ์ ADMIN, TEACHER, STUDENT, PENDING_TEACHER
- รองรับ ADMIN • TEACHER dual-role
- สร้างและใช้งาน course offering
- Seed teacher baseline
- Import student roster
- Workflow Lifecycle v2 ตั้งแต่เริ่มโครงงานถึง Admin closeout
- Dashboard แบบ action queue สำหรับ Admin และ Teacher
- Mobile dashboard ที่กระชับขึ้น
- Checklist/rubric scoring สำหรับรอบ presentation
- Report review workflow
- Advisor score
- Evidence & AUN-QA dashboard
- Export evidence เป็น CSV และ Excel (.xlsx)

### ข้อจำกัดของ pilot

- Report/article numeric scoring ยังไม่ใช่ scope หลัก ระบบเก็บ report approval/revision evidence
- Evidence export ยังโหลดข้อมูลเป็นชุดใน memory เหมาะกับ pilot scale ก่อน
- Audit export เป็น global audit log ทั้งระบบ ยังไม่ filter ตาม course offering
- ระบบไม่ทำ official CLO/PLO/AUN mapping อัตโนมัติ
- หากข้อมูล production จริงถูกลบหรือแก้ฐานข้อมูลโดยตรง อาจกระทบ evidence trail

## 2. การเตรียมก่อนเริ่ม Pilot

### Production URL

ใช้ Production URL ที่ทีมผู้ดูแลระบบประกาศสำหรับ pilot เท่านั้น ห้ามใช้ local development URL หรือ preview URL ที่ไม่ได้ยืนยัน

ก่อนเริ่ม pilot ให้ Admin ตรวจว่า:

- URL เปิดได้จากเครือข่ายมหาวิทยาลัย
- Login ด้วย Google ได้จริง
- ไม่ได้เปิด dev-login ใน production
- Vercel Production deployment ล่าสุดอยู่ในสถานะ Ready

### Google login requirement

| ผู้ใช้ | รูปแบบบัญชี |
| --- | --- |
| นักศึกษา | `{student_code}@student.sru.ac.th` |
| อาจารย์ | บัญชี Google ของ `@sru.ac.th` |
| Admin | บัญชีที่ระบบกำหนดสิทธิ์ ADMIN ไว้แล้ว |

ข้อควรระวัง:

- ห้ามใช้บัญชีส่วนตัวที่ไม่ใช่ domain ที่กำหนดในการ pilot จริง
- หากอาจารย์ login แล้วได้สถานะ pending ต้องให้ Admin อนุมัติ claim ก่อน
- หากนักศึกษาเข้าไม่ได้ ให้ตรวจ student roster และ email ที่ generate จากรหัสนักศึกษา

### Admin account

ก่อน pilot ต้องมีอย่างน้อย 1 บัญชีที่เข้า `/admin` ได้จริง

ตรวจสอบ:

- Login สำเร็จ
- เห็น Admin dashboard
- เห็นเมนู Evidence & AUN-QA
- สามารถเปิดหน้าจัดการอาจารย์ นักศึกษา รอบสอบ และ closeout ได้

### Teacher account

ก่อน pilot ต้องมี teacher baseline ในระบบ และอาจารย์ควร login เพื่อตรวจสิทธิ์

กรณี teacher profile ยังไม่มี email:

1. อาจารย์ login ด้วย Google `@sru.ac.th`
2. เลือก profile ของตนเองในหน้า claim
3. ระบบสร้าง claim สถานะ pending
4. Admin อนุมัติ claim
5. อาจารย์จึงเข้าหน้า Teacher dashboard และ scoring pages ได้

### Student roster

ไฟล์ roster ควรมีข้อมูลขั้นต่ำ:

| field | คำอธิบาย |
| --- | --- |
| `student_code` | รหัสนักศึกษา |
| `first_name_th` | ชื่อภาษาไทย |
| `last_name_th` | นามสกุลภาษาไทย |

ระบบจะสร้าง email ให้อัตโนมัติในรูปแบบ:

```text
student_code@student.sru.ac.th
```

### Course offering

ก่อนนำเข้านักศึกษา ต้องมี course offering สำหรับภาคเรียนที่ต้องการ เช่น:

```text
ภาคเรียนที่ 1 ปีการศึกษา 2568
```

ข้อควรระวัง:

- ตรวจให้แน่ใจว่านำเข้ารายชื่อเข้ารายวิชาที่ถูกต้อง
- หากมี course offering หลายรายการ ให้เลือกให้ตรงก่อน export evidence
- ระบบ Evidence จะไม่ fallback ไป course offering อื่น หากส่ง ID ที่ไม่ถูกต้อง

### Rubric baseline

ก่อนเปิด scoring round ควรตรวจว่า rubric/checklist มีครบสำหรับ:

- Proposal
- Progress 1
- Progress 2
- Final Presentation

ข้อควรระวัง:

- อย่าแก้ rubric ระหว่างรอบประเมินโดยไม่แจ้งทีม pilot
- หากมี rubric หลาย version ระบบ evidence จะนับคะแนนตาม rubric item ที่ผูกกับ score item จริง

### Checklist ก่อนเปิดใช้งาน

| รายการ | สถานะ |
| --- | --- |
| Production URL เปิดได้ | ☐ |
| Admin login ได้ | ☐ |
| Teacher login และ claim flow ผ่าน | ☐ |
| Student login ได้อย่างน้อย 1 คน | ☐ |
| Course offering ถูกต้อง | ☐ |
| Student roster พร้อม import | ☐ |
| Teacher baseline พร้อม | ☐ |
| Rubric baseline พร้อม | ☐ |
| Dashboard แสดงข้อมูลถูกต้อง | ☐ |
| Evidence export CSV/XLSX ทดสอบแล้ว | ☐ |

## 3. บทบาทผู้ใช้

### ADMIN

| หัวข้อ | รายละเอียด |
| --- | --- |
| หน้าที่หลัก | ตั้งค่ารายวิชา นำเข้านักศึกษา อนุมัติ teacher claim จัดการรอบสอบ ตัดสิน Proposal แต่งตั้งกรรมการ ปิดงาน Export evidence |
| เมนูที่เกี่ยวข้อง | `/admin`, `/admin/teachers`, `/admin/students`, `/admin/import-students`, `/admin/claims`, `/admin/proposals`, `/admin/committee`, `/admin/rounds`, `/admin/closeout`, `/admin/evidence` |
| สิ่งที่ทำได้ | เห็นภาพรวมระบบ จัดการ workflow สำคัญ Export evidence |
| สิ่งที่ทำไม่ได้ | ไม่ควรแก้ฐานข้อมูลโดยตรง ไม่ควรตัดสินแทนอาจารย์ในส่วน scoring นอกจากขั้นตอน Admin decision |

### TEACHER

| หัวข้อ | รายละเอียด |
| --- | --- |
| หน้าที่หลัก | รับ/ปฏิเสธ advisor request ให้คะแนน presentation ตรวจรายงาน ให้ Advisor score |
| เมนูที่เกี่ยวข้อง | `/teacher`, `/teacher/advisor-requests`, `/teacher/proposals`, `/teacher/progress1`, `/teacher/progress2`, `/teacher/final`, `/teacher/reports`, `/teacher/advisor-score` |
| สิ่งที่ทำได้ | เห็นงานที่เกี่ยวข้องกับตนเอง ให้คะแนนหรือ review ตาม assignment |
| สิ่งที่ทำไม่ได้ | เห็นข้อมูลนักศึกษาทั้งระบบ ตัดสิน Proposal ขั้นสุดท้าย ปิดงานเป็น COMPLETED |

### STUDENT

| หัวข้อ | รายละเอียด |
| --- | --- |
| หน้าที่หลัก | กรอก profile เริ่มโครงงาน ขอที่ปรึกษา ส่งหลักฐาน presentation/report ดูสถานะและ feedback |
| เมนูที่เกี่ยวข้อง | `/student`, `/student/profile`, `/student/origin`, `/student/project`, `/student/proposal`, `/student/schedule`, `/student/report`, `/student/feedback` |
| สิ่งที่ทำได้ | เห็นเฉพาะ project ของตนเอง ส่งข้อมูลตามขั้นตอน ดู feedback ที่เปิดเผยแล้ว |
| สิ่งที่ทำไม่ได้ | เห็นคะแนนดิบที่ไม่เปิดเผย เห็นข้อมูล project ของผู้อื่น แก้ข้อมูลหลัง deadline/lock โดยไม่มี Admin unlock |

### PENDING_TEACHER

| หัวข้อ | รายละเอียด |
| --- | --- |
| หน้าที่หลัก | รอ Admin อนุมัติ teacher claim |
| เมนูที่เกี่ยวข้อง | หน้า teacher claim |
| สิ่งที่ทำได้ | เลือก teacher profile และส่งคำขอ claim |
| สิ่งที่ทำไม่ได้ | เข้าถึงข้อมูลนักศึกษา scoring page หรือ teacher dashboard เต็มรูปแบบ |

### ADMIN • TEACHER dual-role

ผู้ใช้บางคนอาจมีสิทธิ์ทั้ง Admin และ Teacher

ข้อควรระวัง:

- ใช้บทบาทให้ตรงกับงานที่กำลังทำ
- เมื่อทำ scoring ให้ทำในฐานะ Teacher
- เมื่ออนุมัติ workflow หรือ export evidence ให้ทำในฐานะ Admin
- หลีกเลี่ยงการทดสอบหลายบทบาทใน browser เดียวหากสับสนเรื่อง session

## 4. Workflow หลักของระบบ

Lifecycle v2 เป็น workflow หลักของ project ใน pilot นี้

### สรุปขั้นตอน

| ลำดับ | สถานะ/ขั้นตอน | ผู้รับผิดชอบหลัก |
| --- | --- | --- |
| 1 | Student profile | Student |
| 2 | Draft | Student |
| 3 | Advisor approval | Teacher/Advisor |
| 4 | Admin approval | Admin |
| 5 | Proposal review | Teacher/Committee |
| 6 | Proposal decision | Admin |
| 7 | Topic approved | Admin/System |
| 8 | In progress | Student/Teacher |
| 9 | Progress 1 | Student/Teacher/Admin |
| 10 | Progress 2 | Student/Teacher/Admin |
| 11 | Final presentation | Student/Teacher/Admin |
| 12 | Report review | Student/Teacher |
| 13 | Report approved | Teacher/Admin |
| 14 | Advisor score | Advisor |
| 15 | Admin closeout to COMPLETED | Admin |

### 1. Student profile

| หัวข้อ | รายละเอียด |
| --- | --- |
| ผู้รับผิดชอบ | Student |
| หน้าที่ต้องทำ | Login และกรอกข้อมูลส่วนตัวที่จำเป็น |
| หน้าจอที่ใช้ | `/student/profile` |
| หลักฐานที่ระบบเก็บ | profile completion, timeline/status evidence ตามที่ระบบบันทึก |
| ผลลัพธ์ | นักศึกษาพร้อมเริ่ม draft/project origin |

### 2. Draft

| หัวข้อ | รายละเอียด |
| --- | --- |
| ผู้รับผิดชอบ | Student |
| หน้าที่ต้องทำ | เริ่มร่างหัวข้อ/ที่มาโครงงาน |
| หน้าจอที่ใช้ | `/student/origin`, `/student/project` |
| หลักฐานที่ระบบเก็บ | ProjectOriginVersion, timeline event |
| ผลลัพธ์ | project มีข้อมูลเบื้องต้นและพร้อมเลือกที่ปรึกษา |

### 3. Advisor approval

| หัวข้อ | รายละเอียด |
| --- | --- |
| ผู้รับผิดชอบ | Student, Teacher/Advisor |
| หน้าที่ต้องทำ | Student ส่งคำขอที่ปรึกษา อาจารย์ตอบรับหรือปฏิเสธ |
| หน้าจอที่ใช้ | Student dashboard, `/teacher/advisor-requests` |
| หลักฐานที่ระบบเก็บ | advisor request, review time, timeline/status evidence |
| ผลลัพธ์ | หากอนุมัติ project จะรอ Admin approval |

### 4. Admin approval

| หัวข้อ | รายละเอียด |
| --- | --- |
| ผู้รับผิดชอบ | Admin |
| หน้าที่ต้องทำ | ตรวจ project และยืนยัน advisor/project |
| หน้าจอที่ใช้ | `/admin` |
| หลักฐานที่ระบบเก็บ | status history, audit log, timeline event |
| ผลลัพธ์ | project เข้าสู่ขั้นตอน Proposal |

### 5. Proposal review

| หัวข้อ | รายละเอียด |
| --- | --- |
| ผู้รับผิดชอบ | Teacher/Committee |
| หน้าที่ต้องทำ | ตรวจ proposal และบันทึก checklist score/comment/decision |
| หน้าจอที่ใช้ | `/teacher/proposals`, `/teacher/scoring/[assignmentId]` |
| หลักฐานที่ระบบเก็บ | PresentationSubmissionVersion, ScoreSubmission, ScoreItem, proposal comment |
| ผลลัพธ์ | Admin เห็นผลประเมินเพื่อพิจารณา decision |

### 6. Proposal decision

| หัวข้อ | รายละเอียด |
| --- | --- |
| ผู้รับผิดชอบ | Admin |
| หน้าที่ต้องทำ | ตรวจคะแนน ความเห็น และผลประชุม ก่อนเลือก final decision |
| หน้าจอที่ใช้ | `/admin/proposals` |
| หลักฐานที่ระบบเก็บ | ProjectProposalResult, audit log, timeline event |
| ผลลัพธ์ | หัวข้อผ่าน แก้ไข หรือไม่ผ่านตาม decision |

### 7. Topic approved

| หัวข้อ | รายละเอียด |
| --- | --- |
| ผู้รับผิดชอบ | Admin/System |
| หน้าที่ต้องทำ | ตรวจว่าหัวข้อเข้าสู่สถานะอนุมัติแล้ว และเตรียมกรรมการ/รอบถัดไป |
| หน้าจอที่ใช้ | `/admin`, `/admin/committee` |
| หลักฐานที่ระบบเก็บ | status history, timeline event |
| ผลลัพธ์ | พร้อมแต่งตั้งกรรมการและเดินรอบ Progress |

### 8. In progress

| หัวข้อ | รายละเอียด |
| --- | --- |
| ผู้รับผิดชอบ | Student, Advisor, Admin |
| หน้าที่ต้องทำ | นักศึกษาดำเนินโครงงาน อาจารย์ติดตาม Admin เปิดรอบที่เกี่ยวข้อง |
| หน้าจอที่ใช้ | Student dashboard, Teacher dashboard, `/admin/rounds` |
| หลักฐานที่ระบบเก็บ | timeline/status evidence ตามกิจกรรม |
| ผลลัพธ์ | project พร้อมเข้าสู่ Progress 1 |

### 9. Progress 1

| หัวข้อ | รายละเอียด |
| --- | --- |
| ผู้รับผิดชอบ | Admin, Student, Teacher/Committee |
| หน้าที่ต้องทำ | Admin เปิดรอบ Student ส่งหลักฐาน Teacher ให้คะแนน |
| หน้าจอที่ใช้ | `/admin/rounds`, `/student/schedule`, `/teacher/progress1` |
| หลักฐานที่ระบบเก็บ | AssessmentRound, AssessmentAttempt, PresentationSubmissionVersion, ScoreSubmission, ScoreItem |
| ผลลัพธ์ | มีหลักฐานคะแนน Progress 1 |

### 10. Progress 2

| หัวข้อ | รายละเอียด |
| --- | --- |
| ผู้รับผิดชอบ | Admin, Student, Teacher/Committee |
| หน้าที่ต้องทำ | เปิด/ดำเนินรอบ Progress 2 และบันทึกคะแนน |
| หน้าจอที่ใช้ | `/admin/rounds`, `/student/schedule`, `/teacher/progress2` |
| หลักฐานที่ระบบเก็บ | AssessmentRound, AssessmentAttempt, PresentationSubmissionVersion, ScoreSubmission, ScoreItem |
| ผลลัพธ์ | มีหลักฐานคะแนน Progress 2 |

### 11. Final presentation

| หัวข้อ | รายละเอียด |
| --- | --- |
| ผู้รับผิดชอบ | Admin, Student, Teacher/Committee |
| หน้าที่ต้องทำ | เปิด/ดำเนินรอบ Final และบันทึกคะแนน |
| หน้าจอที่ใช้ | `/admin/rounds`, `/student/schedule`, `/teacher/final` |
| หลักฐานที่ระบบเก็บ | AssessmentRound, AssessmentAttempt, PresentationSubmissionVersion, ScoreSubmission, ScoreItem |
| ผลลัพธ์ | มีหลักฐานคะแนน Final Presentation |

### 12. Report review

| หัวข้อ | รายละเอียด |
| --- | --- |
| ผู้รับผิดชอบ | Student, Teacher/Advisor |
| หน้าที่ต้องทำ | Student ส่ง link รายงาน Teacher review ผ่าน/ไม่ผ่าน |
| หน้าจอที่ใช้ | `/student/report`, `/teacher/reports` |
| หลักฐานที่ระบบเก็บ | ReportVersion, ReportReview |
| ผลลัพธ์ | หากผ่าน เข้าสู่ report approved |

### 13. Report approved

| หัวข้อ | รายละเอียด |
| --- | --- |
| ผู้รับผิดชอบ | Teacher/Advisor, Admin |
| หน้าที่ต้องทำ | ตรวจว่ามี report approval evidence |
| หน้าจอที่ใช้ | `/teacher/reports`, `/admin/closeout` |
| หลักฐานที่ระบบเก็บ | ReportReview decision PASS, status history |
| ผลลัพธ์ | project พร้อมเข้าสู่ Advisor score |

### 14. Advisor score

| หัวข้อ | รายละเอียด |
| --- | --- |
| ผู้รับผิดชอบ | Advisor |
| หน้าที่ต้องทำ | บันทึก Advisor score 25% |
| หน้าจอที่ใช้ | `/teacher/advisor-score` |
| หลักฐานที่ระบบเก็บ | AdvisorScore, submittedAt, comment |
| ผลลัพธ์ | project พร้อมให้ Admin closeout |

### 15. Admin closeout to COMPLETED

| หัวข้อ | รายละเอียด |
| --- | --- |
| ผู้รับผิดชอบ | Admin |
| หน้าที่ต้องทำ | ตรวจ checklist closeout แล้วเปลี่ยนสถานะเป็น COMPLETED |
| หน้าจอที่ใช้ | `/admin/closeout` |
| หลักฐานที่ระบบเก็บ | ProjectStatusHistory, AuditLog, ProjectTimelineEvent |
| ผลลัพธ์ | project เสร็จสมบูรณ์ในระบบ |

## 5. คู่มือ Admin

### Login

1. เปิด Production URL
2. กด login ด้วย Google
3. ใช้บัญชีที่ได้รับสิทธิ์ ADMIN
4. ตรวจว่าเข้า `/admin` ได้

หากเข้าไม่ได้:

- ตรวจ role ของบัญชี
- ตรวจว่าใช้บัญชี Google ถูก domain
- แจ้งผู้ดูแลระบบเทคนิคเพื่อตรวจ production env/session

### Admin dashboard

Admin dashboard แสดงรายการงานที่ต้องดำเนินการก่อน เช่น:

- คำขอผูกบัญชีอาจารย์
- Project รอ Admin confirmation
- Proposal รอตัดสิน
- งานตั้งกรรมการ
- รอบสอบที่ต้องจัดการ
- Closeout/completion
- ทางเข้า Evidence & AUN-QA

### Course offering setup

1. เข้าเมนู import/course offering
2. ตรวจภาคเรียนและปีการศึกษา
3. สร้างหรือเลือก course offering ที่ต้องการ
4. ตรวจว่ารายชื่อและรอบสอบจะผูกกับ course offering ที่ถูกต้อง

### Student import

1. เตรียมไฟล์ roster
2. ตรวจคอลัมน์ `student_code`, `first_name_th`, `last_name_th`
3. เข้าเมนูนำเข้านักศึกษา
4. เลือก course offering ให้ถูกต้อง
5. Import และตรวจจำนวนรายการ

ข้อผิดพลาดที่พบบ่อย:

- เลือก course offering ผิด
- student_code มีช่องว่างหรือรูปแบบไม่ถูกต้อง
- ชื่อซ้ำหรือรหัสซ้ำ

### Teacher management

Admin ใช้เมนูจัดการอาจารย์เพื่อตรวจ teacher baseline และสถานะบัญชี

ควรตรวจ:

- ชื่ออาจารย์ถูกต้อง
- คำนำหน้าชื่อถูกต้อง
- email เชื่อมถูกบัญชีหลัง claim
- ไม่มี profile ซ้ำที่ทำให้ claim ผิดคน

### Teacher claim approval

1. เข้า `/admin/claims`
2. ตรวจชื่ออาจารย์และบัญชี Google ที่ขอ claim
3. หากถูกต้อง กดอนุมัติ
4. หากผิดคนหรือข้อมูลไม่ชัดเจน ให้ reject และแจ้งอาจารย์

ข้อควรระวัง:

- อย่าอนุมัติ claim หากไม่แน่ใจว่าเป็นอาจารย์คนเดียวกัน
- Teacher pending ยังไม่ควรเห็นข้อมูลนักศึกษา

### Advisor request review

Admin ติดตามภาพรวมได้จาก dashboard แต่ผู้ตอบรับหลักคืออาจารย์ที่ถูกขอเป็น advisor

Admin ควรตรวจ:

- Project ที่รอ advisor นานผิดปกติ
- Project ที่ advisor อนุมัติแล้วรอ Admin confirmation
- นักศึกษาที่เลือก advisor ผิดคน

### Opening/closing rounds

ใช้ `/admin/rounds`

Admin ควร:

- เปิดรอบตามลำดับ workflow
- ตรวจ eligibility ก่อนเปิด Progress 1/2/Final
- ไม่สร้างรอบสอบซ้ำต่อ project
- ใช้ course-level `AssessmentRound` เท่านั้น

### Proposal decision

ใช้ `/admin/proposals`

ขั้นตอน:

1. ตรวจ score submission ของอาจารย์
2. อ่าน comment/reason
3. ตรวจสัญญาณ vote ที่มีความเสี่ยง เช่น FAIL จำนวนมาก
4. เลือก final decision
5. บันทึกเหตุผลเมื่อจำเป็น

ข้อควรระวัง:

- ระบบไม่ตัดสิน Proposal อัตโนมัติ
- Admin ต้องตัดสินตามผลประชุม/แนวปฏิบัติของรายวิชา

### Committee assignment

ใช้ `/admin/committee`

Admin ควร:

- แต่งตั้งกรรมการหลังหัวข้อผ่าน
- ตรวจบทบาทกรรมการ เช่น HEAD, MEMBER, EXTERNAL_MEMBER
- ตรวจว่า assignment active ถูกต้อง

### Closeout

ใช้ `/admin/closeout`

ก่อนปิดงานเป็น COMPLETED ต้องตรวจ:

- Progress 1 score evidence
- Progress 2 score evidence
- Final presentation score evidence
- Report approval evidence
- Advisor score
- ไม่มี report revision ที่ยังไม่ปิด
- สถานะพร้อม closeout

### Evidence module

ใช้ `/admin/evidence`

Admin สามารถ:

- เลือก course offering
- ดู project evidence status
- ดู rubric-attributed score evidence
- ดู recent timeline event
- ดู recent global audit action
- Export CSV/XLSX

### Export CSV/XLSX

ในหน้า Evidence & AUN-QA มี export ดังนี้:

| Export | CSV | Excel |
| --- | --- | --- |
| Project evidence | ได้ | ได้ |
| Timeline events | ได้ | ได้ |
| Rubric score evidence | ได้ | ได้ |
| Report reviews | ได้ | ได้ |
| Global audit logs | ได้ | ได้ |

ข้อควรระวัง:

- Audit logs เป็น global export ทั้งระบบ
- เลือก course offering ให้ถูกก่อน export project/timeline/scores/reports
- ไฟล์ export มีข้อมูลส่วนบุคคลและหลักฐานทางวิชาการ ต้องจัดเก็บอย่างเหมาะสม

### Common admin mistakes

| ปัญหา | วิธีป้องกัน |
| --- | --- |
| เลือก course offering ผิด | ตรวจชื่อภาคเรียนก่อน import/export |
| อนุมัติ teacher claim ผิดคน | ตรวจชื่อและบัญชี Google ก่อนกดอนุมัติ |
| เปิดรอบผิดลำดับ | ตรวจ eligibility และ dashboard ก่อนเปิดรอบ |
| ตัดสิน Proposal โดยไม่อ่าน comment | อ่าน score/comment/reason ก่อนตัดสิน |
| ล้างข้อมูล production โดยไม่ตั้งใจ | อย่าใช้ test tools กับข้อมูลจริง |

### Pilot checklist for admin

| รายการ | สถานะ |
| --- | --- |
| เข้า `/admin` ได้ | ☐ |
| เห็น course offering ถูกต้อง | ☐ |
| Import roster สำเร็จ | ☐ |
| อนุมัติ teacher claim ทดสอบแล้ว | ☐ |
| ยืนยัน advisor/project ได้ | ☐ |
| เปิดรอบ Proposal/Progress ได้ตามลำดับ | ☐ |
| ตัดสิน Proposal ได้ | ☐ |
| Closeout project ทดสอบได้ | ☐ |
| Export CSV/XLSX ได้ | ☐ |

## 6. คู่มือ Teacher

### Login

1. เปิด Production URL
2. Login ด้วย Google `@sru.ac.th`
3. หากระบบให้ claim profile ให้เลือกชื่อของตนเอง
4. รอ Admin อนุมัติ
5. หลังอนุมัติ เข้า `/teacher` ได้

### Teacher dashboard

Teacher dashboard แสดงงานที่เกี่ยวข้อง เช่น:

- Advisor request
- Proposal scoring
- Progress scoring
- Final scoring
- Report review
- Advisor score

### Teacher claim / linked profile

หาก profile ยังไม่ linked:

1. เลือก teacher profile ที่ตรงกับชื่อของตนเอง
2. ส่งคำขอ claim
3. รอ Admin อนุมัติ
4. หากเลือกผิด ให้แจ้ง Admin ทันที

### Advisor request handling

ใช้ `/teacher/advisor-requests`

อาจารย์ควร:

- อ่านข้อมูล project/student ก่อนตอบรับ
- ตอบรับเฉพาะ project ที่รับเป็นที่ปรึกษาได้จริง
- ระบุ comment หากปฏิเสธหรือมีข้อแนะนำ

### Proposal scoring

ใช้ `/teacher/proposals` และ scoring page ที่ระบบเปิดให้

ขั้นตอน:

1. เปิดรายการ assigned proposal
2. อ่าน submission และเอกสารแนบ
3. ให้คะแนน checklist
4. เลือก decision ตามที่ระบบกำหนด
5. ใส่ reason เมื่อ decision ต้องการเหตุผล
6. Submit

### Progress 1 / Progress 2 / Final scoring

ใช้:

- `/teacher/progress1`
- `/teacher/progress2`
- `/teacher/final`

แนวปฏิบัติ:

- ตรวจ material link ก่อนให้คะแนน
- ให้คะแนนตาม checklist/rubric
- บันทึก comment ที่เป็นประโยชน์ต่อ feedback/evidence
- ตรวจให้แน่ใจว่ากด submit แล้ว ไม่ใช่แค่ draft

### Report review

ใช้ `/teacher/reports`

อาจารย์ควร:

- เปิด report link
- ตรวจตามเกณฑ์รายวิชา
- เลือก PASS หรือ FAIL
- ใส่ comment/revision request หากไม่ผ่าน

### Advisor score

ใช้ `/teacher/advisor-score`

บันทึกคะแนน Advisor score เมื่อ project ถึงขั้นตอนที่พร้อมแล้ว

ข้อควรระวัง:

- Advisor score เป็นคนละส่วนกับ presentation scoring
- ต้อง submit ให้เรียบร้อยเพื่อให้ Admin closeout ได้

### Evidence visibility

อาจารย์เห็น evidence ที่เกี่ยวข้องกับงานของตนเอง เช่น scoring submission, report review และ feedback บางส่วน แต่ Evidence & AUN-QA dashboard/export เป็นหน้าของ Admin

### Common teacher mistakes

| ปัญหา | วิธีป้องกัน |
| --- | --- |
| ยังไม่ได้ claim profile | ทำ claim และรอ Admin อนุมัติ |
| Submit score ไม่สำเร็จ | ตรวจสถานะในหน้า dashboard/scoring |
| เลือก decision แล้วไม่ใส่ reason | ใส่ reason เมื่อระบบกำหนด |
| เปิด link เอกสารไม่ได้ | แจ้ง student/Admin ให้ตรวจสิทธิ์ Google Drive |
| สับสนบทบาท Admin • Teacher | ใช้หน้า Teacher สำหรับ scoring ใช้หน้า Admin สำหรับจัดการระบบ |

### Pilot checklist for teacher

| รายการ | สถานะ |
| --- | --- |
| Login ได้ | ☐ |
| Claim profile ผ่าน | ☐ |
| เห็น Teacher dashboard | ☐ |
| รับ/ปฏิเสธ advisor request ได้ | ☐ |
| ให้คะแนน Proposal ได้ | ☐ |
| ให้คะแนน Progress/Final ได้ | ☐ |
| Review report ได้ | ☐ |
| Submit Advisor score ได้ | ☐ |

## 7. คู่มือ Student

### Login

1. เปิด Production URL
2. Login ด้วย Google student account
3. ใช้ email รูปแบบ `{student_code}@student.sru.ac.th`
4. หากเข้าไม่ได้ ให้แจ้ง Admin ตรวจ roster

### Student dashboard

Dashboard แสดงงานที่ต้องทำและสถานะ project ของนักศึกษา

นักศึกษาควรใช้ dashboard เป็นหน้าเริ่มต้นเพื่อดู:

- ขั้นตอนปัจจุบัน
- งานที่ต้องส่ง
- สถานะ advisor/project
- feedback ที่เปิดเผยแล้ว

### Completing profile

ใช้ `/student/profile`

กรอกข้อมูลที่ระบบกำหนดให้ครบก่อนเริ่ม workflow อื่น

### Creating draft/origin

ใช้ `/student/origin` หรือ `/student/project`

นักศึกษาควร:

- ระบุหัวข้อหรือที่มาของโครงงานให้ชัด
- ใช้ภาษาไทยให้ตรงตามที่รายวิชากำหนด
- ตรวจ link เอกสารว่าเปิดได้

### Selecting/submitting advisor request

ขั้นตอน:

1. เลือกอาจารย์ที่ต้องการขอเป็นที่ปรึกษา
2. ส่งคำขอ
3. รออาจารย์ตอบรับ
4. หากถูกปฏิเสธ ให้ปรับตามคำแนะนำและเลือกใหม่ตามแนวปฏิบัติของรายวิชา

### Submitting proposal

นักศึกษาควร:

- ตรวจ deadline
- ส่ง material link ที่ถูกต้อง
- ใช้ link จาก `drive.google.com`, `docs.google.com`, หรือ `classroom.google.com`
- ตรวจว่า link เปิดได้สำหรับผู้ประเมิน

### Following approval status

ดูสถานะได้ที่ Student dashboard

สถานะที่ควรเข้าใจ:

- รอที่ปรึกษาอนุมัติ
- รอผู้ดูแลระบบยืนยัน
- อยู่ระหว่างประเมิน Proposal
- รอผลตัดสิน Proposal
- หัวข้อได้รับอนุมัติ
- อยู่ระหว่าง Progress/Final/Report
- เสร็จสมบูรณ์

### Submitting progress/final/report evidence

เมื่อต้องส่งหลักฐาน:

- ใช้หน้าที่ dashboard ชี้ไป
- ส่ง link เอกสาร/สไลด์/รายงานให้ถูกต้อง
- ตรวจสิทธิ์การเข้าถึง
- ส่งก่อน deadline

### Reading feedback

ใช้ `/student/feedback`

ข้อควรทราบ:

- Proposal feedback อาจแสดงโดยไม่เปิดเผยคะแนนดิบ
- Feedback ของรอบถัดไปอาจแสดงชื่อผู้ประเมินตามกติกาของระบบ
- นักศึกษาจะเห็น feedback เมื่อ Admin release หรือ workflow อนุญาตแล้ว

### Common student mistakes

| ปัญหา | วิธีป้องกัน |
| --- | --- |
| ใช้ email ผิด | ใช้ `{student_code}@student.sru.ac.th` |
| Link เปิดไม่ได้ | ตั้งค่า sharing ให้ผู้เกี่ยวข้องเปิดได้ |
| ส่งผิด course/project | ตรวจ dashboard ก่อนส่ง |
| รอ advisor นาน | แจ้ง Admin หรืออาจารย์ประจำรายวิชา |
| ไม่เห็น feedback | ตรวจว่าผลถูก release แล้วหรือยัง |

### Pilot checklist for student

| รายการ | สถานะ |
| --- | --- |
| Login ได้ | ☐ |
| กรอก profile ครบ | ☐ |
| สร้าง draft/origin ได้ | ☐ |
| ส่ง advisor request ได้ | ☐ |
| ส่ง Proposal ได้ | ☐ |
| ส่งหลักฐาน Progress/Final ได้ | ☐ |
| ส่ง report ได้ | ☐ |
| อ่าน feedback ได้ | ☐ |

## 8. Evidence & AUN-QA Module

### Purpose

Evidence & AUN-QA module ใช้รวบรวม สรุป และส่งออกหลักฐานการดำเนินงานของรายวิชา เพื่อช่วยให้ Admin และ programme QA staff ตรวจสอบความครบถ้วนของ evidence ได้รวดเร็วขึ้น

### What evidence is collected

ระบบรวบรวมหลักฐานจาก workflow ที่มีอยู่แล้ว ไม่ได้สร้าง business logic ใหม่เพื่อเปลี่ยนผลการประเมิน

### Evidence sources

| แหล่งข้อมูล | ใช้เป็นหลักฐาน |
| --- | --- |
| ProjectTimelineEvent | เหตุการณ์สำคัญของ project |
| ProjectStatusHistory | ประวัติการเปลี่ยนสถานะ |
| AuditLog | การกระทำสำคัญของ Admin/system |
| ProjectOriginVersion | version ของที่มา/หัวข้อโครงงาน |
| PresentationSubmissionVersion | version ของ submission presentation |
| ScoreSubmission / ScoreItem | คะแนน checklist/rubric และ item evidence |
| ReportVersion / ReportReview | การส่งรายงานและผล review |
| AdvisorScore | คะแนน advisor 25% |
| Rubrics / rubric items | โครงสร้างเกณฑ์ประเมิน |

### How to open Admin Evidence page

1. Login เป็น Admin
2. เข้า `/admin`
3. กด `Evidence & AUN-QA`
4. เลือก course offering

### Project evidence completeness

หน้า Evidence แสดง:

- นักศึกษา
- หัวข้อ project
- advisor
- current status
- evidence ของ Progress 1 / Progress 2 / Final
- report approval evidence
- advisor score evidence
- timeline/status history count
- last evidence update
- missing evidence

คำว่า evidence ในหน้านี้หมายถึงพบข้อมูลหลักฐานที่บันทึกแล้ว ไม่ใช่การคำนวณคะแนนใหม่

### Rubric/evaluation evidence

ระบบแสดง rubric-attributed score evidence โดยนับจากความสัมพันธ์:

```text
ScoreItem -> RubricItem -> Rubric
```

จึงลดความสับสนเมื่อมี rubric หลาย version

### Report review evidence

Export report review รวม:

- report version
- project/student
- drive link
- submitted time
- reviewer
- decision
- reviewed time
- comment

### Audit evidence

Audit export เป็น global audit log ทั้งระบบ ไม่ได้ filter ตาม course offering

ข้อควรระวัง:

- ใช้เพื่อดู decision/action trail ในภาพรวม
- ไม่ควรส่งต่อให้ผู้ที่ไม่เกี่ยวข้อง
- ไม่ export secrets หรือ auth token

### CSV export

CSV export เหมาะสำหรับ:

- เปิดใน Excel
- ตรวจ raw data
- ส่งต่อให้ทีม QA ที่ต้องการไฟล์ขนาดเล็ก

ไฟล์ CSV มี UTF-8 BOM เพื่อรองรับภาษาไทยใน Excel

### Excel export

Excel export เหมาะสำหรับ:

- ทีม QA/AUN-QA ที่ทำงานกับ `.xlsx`
- รวมเป็นภาคผนวกหลักฐาน
- ตรวจข้อมูลในรูปแบบ spreadsheet

ไฟล์ที่รองรับ:

- `evidence-projects-YYYYMMDD.xlsx`
- `evidence-timeline-YYYYMMDD.xlsx`
- `evidence-scores-YYYYMMDD.xlsx`
- `evidence-reports-YYYYMMDD.xlsx`
- `evidence-audit-YYYYMMDD.xlsx`

### Sensitive-data warning

ไฟล์ export อาจมี:

- ชื่อนักศึกษา
- รหัสนักศึกษา
- email นักศึกษา
- ชื่ออาจารย์
- project title
- comment/review
- report/material link
- audit action metadata

ให้จัดเก็บไฟล์ในพื้นที่ที่ควบคุมสิทธิ์ และไม่ส่งต่อในช่องทางสาธารณะ

### How exported files support QA/AUN-QA

| ประเภทหลักฐาน | ไฟล์ที่เกี่ยวข้อง |
| --- | --- |
| Assessment evidence | scores/rubrics export |
| Rubric-based scoring evidence | scores/rubrics export |
| Feedback/revision evidence | timeline, reports, scores |
| Student progression evidence | timeline, project evidence |
| Project completion evidence | project evidence, reports, advisor score |
| Decision/audit trail evidence | audit logs, timeline |

### Remaining limitations

- ไม่ใช่ official CLO/PLO/AUN mapping
- Audit export ยังเป็น global
- Export ขนาดใหญ่มากอาจต้องใช้ streaming/pagination ในอนาคต
- Evidence completeness เป็นตัวช่วยตรวจหลักฐาน ไม่ใช่ตัวตัดสินผลแทนคณะกรรมการหรือ Admin

## 9. Mobile Usage

### What works well on mobile

- ดู dashboard
- ดู action queue
- ตรวจงานที่ต้องทำถัดไป
- ติดตามสถานะ project
- เปิด feedback หรือข้อมูลสรุป

### Recommended mobile tasks

| ผู้ใช้ | งานที่เหมาะบนมือถือ |
| --- | --- |
| Admin | ดู dashboard, ตรวจงานค้าง, ดูสถานะคร่าว ๆ |
| Teacher | ดูงานที่ต้องให้คะแนน, รับทราบ advisor request, ตรวจรายการ report |
| Student | ดูสถานะ ส่งข้อมูลสั้น ๆ ตรวจ feedback |

### Tasks better done on desktop

- Import roster
- Export CSV/XLSX
- Scoring ที่ต้องอ่านเอกสารหลายส่วน
- Proposal decision
- Committee assignment
- Closeout
- ตรวจ Evidence table ขนาดใหญ่

### Compact dashboard/action queue

Mobile dashboard ถูกออกแบบให้เห็นงานสำคัญก่อน แต่ผู้ใช้ควรใช้ desktop เมื่อทำงานที่มีความเสี่ยงสูงหรือมีข้อมูลจำนวนมาก

### Caution

หากมือถือแสดงข้อมูลไม่ครบ ให้หมุนหน้าจอหรือใช้ desktop ก่อนตัดสินใจใน workflow สำคัญ

## 10. Pilot Testing Plan

### Small pilot roster recommendation

เริ่มด้วย:

- นักศึกษา 1-3 คน
- อาจารย์ 2-3 คน
- Admin 1-2 คน
- 1 course offering

### Suggested test project

ใช้หัวข้อทดสอบที่ไม่ใช่ข้อมูลลับ เช่น:

```text
การวิเคราะห์ข้อมูลตัวอย่างเพื่อทดสอบ workflow รายวิชาโครงงาน
```

### Full end-to-end scenario

1. Admin ตรวจ production login
2. Admin สร้าง/เลือก course offering
3. Admin import roster
4. Teacher login และ claim profile
5. Admin อนุมัติ teacher claim
6. Student login และกรอก profile
7. Student สร้าง project draft/origin
8. Student ส่ง advisor request
9. Teacher ตอบรับ advisor request
10. Admin ยืนยัน project/advisor
11. Student ส่ง Proposal
12. Teacher ให้คะแนน Proposal
13. Admin ตัดสิน Proposal
14. Admin ตั้งกรรมการ
15. Admin เปิด Progress 1
16. Student ส่งหลักฐาน Progress 1
17. Teacher ให้คะแนน Progress 1
18. ทำซ้ำสำหรับ Progress 2 และ Final
19. Student ส่ง report
20. Teacher review report
21. Advisor submit Advisor score
22. Admin closeout เป็น COMPLETED
23. Admin export evidence CSV/XLSX

### Admin test checklist

| รายการ | ผ่าน/ไม่ผ่าน | หมายเหตุ |
| --- | --- | --- |
| Login เข้า Admin ได้ |  |  |
| Import roster ได้ |  |  |
| อนุมัติ teacher claim ได้ |  |  |
| ยืนยัน project/advisor ได้ |  |  |
| เปิด round ได้ |  |  |
| ตัดสิน Proposal ได้ |  |  |
| Closeout ได้ |  |  |
| Export CSV/XLSX ได้ |  |  |

### Teacher test checklist

| รายการ | ผ่าน/ไม่ผ่าน | หมายเหตุ |
| --- | --- | --- |
| Login ได้ |  |  |
| Claim profile ได้ |  |  |
| ตอบ advisor request ได้ |  |  |
| ให้คะแนน Proposal ได้ |  |  |
| ให้คะแนน Progress/Final ได้ |  |  |
| Review report ได้ |  |  |
| Submit Advisor score ได้ |  |  |

### Student test checklist

| รายการ | ผ่าน/ไม่ผ่าน | หมายเหตุ |
| --- | --- | --- |
| Login ได้ |  |  |
| กรอก profile ได้ |  |  |
| สร้าง project draft ได้ |  |  |
| ขอ advisor ได้ |  |  |
| ส่ง Proposal ได้ |  |  |
| ส่ง Progress/Final evidence ได้ |  |  |
| ส่ง report ได้ |  |  |
| อ่าน feedback ได้ |  |  |

### Evidence export test checklist

| Export | CSV | Excel | เปิดไฟล์ได้ | หมายเหตุ |
| --- | --- | --- | --- | --- |
| Project evidence | ☐ | ☐ | ☐ |  |
| Timeline events | ☐ | ☐ | ☐ |  |
| Rubric score evidence | ☐ | ☐ | ☐ |  |
| Report reviews | ☐ | ☐ | ☐ |  |
| Global audit logs | ☐ | ☐ | ☐ |  |

### Success criteria

Pilot ถือว่าผ่านเมื่อ:

- ผู้ใช้แต่ละบทบาท login ได้
- Project อย่างน้อย 1 รายการเดิน workflow ได้ครบ
- Scoring submission ถูกบันทึก
- Report review และ Advisor score ถูกบันทึก
- Admin closeout เป็น COMPLETED ได้
- Evidence export เปิดใน Excel ได้
- ผู้ใช้แจ้งปัญหาร้ายแรงด้านสิทธิ์หรือข้อมูลผิดไม่พบ

## 11. Troubleshooting

### Login problem

| อาการ | วิธีตรวจ |
| --- | --- |
| Login ไม่ได้ | ตรวจ Google account และ production URL |
| เข้าแล้วไม่มี role | ตรวจ role ในระบบและ domain email |
| Teacher เห็นหน้า pending | Admin ยังไม่อนุมัติ claim |
| Student เข้าไม่ได้ | ตรวจ roster และ generated email |

### Role not shown

- Logout/login ใหม่
- ตรวจว่าบัญชี Google ถูกต้อง
- ให้ Admin ตรวจข้อมูล user/role

### Teacher not linked

- ให้ teacher เข้า claim profile
- Admin ตรวจ claim แล้วอนุมัติ
- หาก claim ผิด profile ให้ reject และให้ส่งใหม่

### Student cannot see project

สาเหตุที่พบบ่อย:

- นักศึกษา login ด้วย email ผิด
- roster ยังไม่ import
- project ยังไม่ถูกสร้าง
- course offering ผิด

### Save feels slow

- รอสักครู่และอย่ากดซ้ำหลายครั้ง
- ตรวจว่า submit สำเร็จหรือไม่จาก dashboard
- หากช้าต่อเนื่อง แจ้งทีมเทคนิคพร้อมเวลาและหน้าที่ใช้

### Dashboard data not instantly updated

- Refresh หน้า
- ตรวจว่า action สำเร็จแล้วหรือไม่
- หากเป็นงานข้ามบทบาท ให้ผู้เกี่ยวข้อง refresh หลัง action เสร็จ

### Export file cannot open

- ลองเปิด Excel export แทน CSV
- หาก CSV ภาษาไทยเพี้ยน ให้ใช้ไฟล์ `.xlsx`
- หากยังเปิดไม่ได้ ให้ export ใหม่และแจ้ง Admin/ทีมเทคนิค

### Missing evidence

ตรวจจาก `/admin/evidence`:

- ยังไม่มี score submission หรือยังไม่ได้ submit
- report ยังไม่ผ่าน
- advisor score ยังไม่ submit
- Admin closeout ยังไม่ทำ
- เลือก course offering ผิด

### Wrong course offering selected

หากเลือกผิด:

- กลับไปเลือก course offering ใหม่
- อย่าใช้ export เดิมเป็นหลักฐาน
- export ไฟล์ใหม่จาก course offering ที่ถูกต้อง

### Vercel/Supabase production caution

- อย่าล้างข้อมูล production โดยไม่ยืนยัน
- อย่าแก้ฐานข้อมูลโดยตรงหากไม่จำเป็น
- ก่อนแก้ข้อมูลสำคัญควร export evidence และ backup ตามแนวปฏิบัติของทีม

## 12. Data Cleanup and Safety

### Avoid deleting real pilot data

ข้อมูล pilot ที่สร้างจากผู้ใช้จริงถือเป็นหลักฐาน ควรหลีกเลี่ยงการลบ เว้นแต่มีเหตุผลและได้รับอนุมัติ

### Mark demo/E2E data clearly

หากต้องใช้ข้อมูลทดสอบ:

- ตั้งชื่อให้เห็นว่าเป็น demo/test
- อย่าปะปนกับ course offering จริง
- อย่าใช้ข้อมูลทดสอบในการ export QA จริง

### Production database caution

ข้อห้าม:

- ไม่แก้ Prisma schema ระหว่าง pilot โดยไม่วางแผน
- ไม่ลบ record โดยตรงหากยังไม่ได้ backup
- ไม่แก้คะแนนหรือ decision ในฐานข้อมูลโดยตรง
- ไม่ใช้ test cleanup กับข้อมูลจริง

### Export evidence before cleanup

ก่อน cleanup:

1. Export project evidence
2. Export timeline
3. Export scores
4. Export reports
5. Export global audit logs
6. เก็บไฟล์ในพื้นที่ที่ควบคุมสิทธิ์

### Manual database edits

อนุญาตเฉพาะกรณีจำเป็นจริง และควรมี:

- เหตุผล
- ผู้อนุมัติ
- รายการ record ที่แก้
- เวลาแก้
- หลักฐานก่อน/หลังแก้

## 13. Pilot Feedback Form Template

| รายการ | ข้อมูล |
| --- | --- |
| วันที่ทดสอบ |  |
| ชื่อผู้ทดสอบ |  |
| บทบาทผู้ใช้ | ADMIN / TEACHER / STUDENT / QA |
| หน้าที่ใช้งาน |  |
| งานที่พยายามทำ |  |
| สำเร็จหรือไม่ | สำเร็จ / ไม่สำเร็จ / สำเร็จบางส่วน |
| ความยาก | ง่าย / ปานกลาง / ยาก |
| ความเร็ว | เร็ว / ปานกลาง / ช้า |
| ความชัดเจนของ UI | ชัดเจน / พอใช้ / ไม่ชัดเจน |
| ข้อมูลที่ขาด |  |
| error message ที่พบ |  |
| ความเห็นเพิ่มเติม |  |

### Checklist สำหรับ feedback

| คำถาม | ใช่ | ไม่ใช่ | หมายเหตุ |
| --- | --- | --- | --- |
| รู้ว่าต้องกดอะไรต่อหรือไม่ | ☐ | ☐ |  |
| ข้อความภาษาไทยเข้าใจง่ายหรือไม่ | ☐ | ☐ |  |
| หน้าจอโหลดในเวลาที่ยอมรับได้หรือไม่ | ☐ | ☐ |  |
| ใช้งานบนมือถือได้หรือไม่ | ☐ | ☐ |  |
| มีข้อมูลที่ควรแสดงแต่ไม่แสดงหรือไม่ | ☐ | ☐ |  |
| มีขั้นตอนที่ทำผิดได้ง่ายหรือไม่ | ☐ | ☐ |  |

## 14. Final Pilot Readiness Checklist

| รายการ | สถานะ |
| --- | --- |
| Admin login works | ☐ |
| Teacher login works | ☐ |
| Student login works | ☐ |
| Course offering exists | ☐ |
| Roster imported | ☐ |
| Rubric exists | ☐ |
| Teacher baseline checked | ☐ |
| Teacher claim flow tested | ☐ |
| Advisor workflow tested | ☐ |
| Proposal workflow tested | ☐ |
| Progress 1 scoring tested | ☐ |
| Progress 2 scoring tested | ☐ |
| Final scoring tested | ☐ |
| Report workflow tested | ☐ |
| Advisor score tested | ☐ |
| Closeout tested | ☐ |
| Evidence CSV export tested | ☐ |
| Evidence Excel export tested | ☐ |
| Mobile dashboard checked | ☐ |
| Sensitive data handling communicated | ☐ |
| Pilot support contact assigned | ☐ |

เมื่อ checklist นี้ผ่านครบ ระบบพร้อมใช้ pilot กับกลุ่มเล็กได้ โดยยังควรมี Admin และทีมเทคนิคเฝ้าติดตามในช่วงใช้งานจริงรอบแรก
