# Manual Capture Plan

Status: ACTIVE-PLAN

Purpose: แผนถ่ายคู่มือการใช้งาน 3 บทบาทจาก QA manual demo data

## Scope

คู่มือที่จะทำ:

1. คู่มือนักศึกษา
2. คู่มืออาจารย์
3. คู่มือผู้ดูแลระบบ

Environment:

- QA preview
- `/qa-login`
- manual demo identities
- ไม่แตะ production

## คู่มือนักศึกษา

ลำดับถ่าย:

1. เข้าสู่ระบบผ่าน QA login ใน role นักศึกษา
2. หน้า dashboard นักศึกษา
3. กรอกข้อมูล/ตรวจ profile และ project
4. ส่งข้อมูลเสนอหัวข้อ
5. รออาจารย์ที่ปรึกษา
6. ดูสถานะหลังอาจารย์/ผู้ดูแลระบบอนุมัติ
7. ส่งหลักฐาน Proposal
8. เสนอวันสอบ
9. ดูผล/ข้อเสนอแนะ
10. ส่ง Progress 1 / Progress 2 / Final ตามลำดับ
11. ส่งรายงาน
12. ดูสถานะเสร็จสิ้น

## คู่มืออาจารย์

ลำดับถ่าย:

1. เข้าสู่ระบบผ่าน QA login ใน role อาจารย์
2. หน้า dashboard อาจารย์
3. ดูคิวงานที่ต้องดำเนินการ
4. อนุมัติ/ปฏิเสธคำขอเป็นอาจารย์ที่ปรึกษา
5. ตรวจ Proposal
6. อนุมัติ/ปฏิเสธตารางสอบ
7. บันทึกคะแนน Progress 1
8. บันทึกคะแนน Progress 2
9. บันทึกคะแนน Final
10. ตรวจรายงานและขอแก้ไข/ผ่าน
11. บันทึกคะแนนอาจารย์ที่ปรึกษา

## คู่มือผู้ดูแลระบบ

ลำดับถ่าย:

1. เข้าสู่ระบบผ่าน QA login ใน role ผู้ดูแลระบบ
2. หน้า dashboard ผู้ดูแลระบบ
3. ตรวจรายชื่อนักศึกษา/โครงงาน
4. เปิด/ปิดรอบ Proposal
5. อนุมัติหัวข้อและจัดการมติ Proposal
6. แต่งตั้งกรรมการ
7. ตรวจตารางสอบ
8. เปิด/ปิด Progress 1
9. เปิด/ปิด Progress 2
10. เปิด/ปิด Final
11. ตรวจรายงาน
12. ตรวจ evidence/export
13. closeout โครงงานเป็น completed

## Screenshot Rules

- ถ่ายเฉพาะจุดที่จำเป็นต่อคู่มือ
- หลีกเลี่ยง secret หรือ URL ที่มี token
- ถ้าเป็น QA login ให้ crop หรืออธิบายว่าเป็นหน้าทดสอบภายใน
- ชื่อไฟล์ควรขึ้นต้นด้วย role และลำดับ เช่น `student-01-dashboard.png`

## Output Drafts

สร้างเอกสารคู่มือร่าง:

- `docs/manual/STUDENT_USER_MANUAL.md`
- `docs/manual/TEACHER_USER_MANUAL.md`
- `docs/manual/ADMIN_USER_MANUAL.md`

ภายหลังค่อย export เป็น PDF/DOCX ถ้าต้องการ
