# Testing Mode Review

สถานะปัจจุบัน: ระบบอยู่ในช่วงทดสอบก่อนใช้งานจริง สามารถเปิดเครื่องมือช่วยล้างข้อมูลได้แบบชั่วคราว

## เป้าหมาย

- ทดลอง workflow หลายรอบโดยไม่ต้องลบข้อมูลเองในฐานข้อมูล
- หา bug จากการเปิด/ปิดรอบ Proposal, Progress 1, Progress 2 และ Final ตามลำดับจริง
- ล้างข้อมูลของรายวิชาทดสอบแล้วเริ่ม import นักศึกษาใหม่ได้
- ไม่แตะข้อมูลอาจารย์, admin, teacher claim และ rubric พื้นฐาน

## การเปิด/ปิดโหมดทดสอบ

เปิดเฉพาะช่วงทดสอบ:

```env
ENABLE_ADMIN_TEST_TOOLS=1
```

ปิดก่อนใช้งานจริง:

```env
ENABLE_ADMIN_TEST_TOOLS=0
```

หรือเอา env นี้ออกจาก Vercel ก็ได้

## ปุ่มที่เพิ่มใน Admin Dashboard

เมื่อเปิด `ENABLE_ADMIN_TEST_TOOLS=1` และมี course offering ปัจจุบัน ระบบจะแสดงกล่อง:

```text
โหมดทดสอบระบบเปิดอยู่
ล้างข้อมูลทดสอบรายวิชานี้
```

ปุ่มนี้จะล้างข้อมูลที่ผูกกับ course offering ปัจจุบัน:

- projects
- imported students ที่ไม่มี project ในรายวิชาอื่น
- assessment rounds
- assessment attempts
- proposal/progress/final submissions
- scores
- schedule proposals
- report versions/reviews
- advisor scores
- project timeline/status history
- project notifications

ปุ่มนี้จะไม่ล้าง:

- admin user
- teacher profiles
- teacher email/linking
- teacher claims
- rubrics/config พื้นฐาน
- audit log

## ปุ่มรีเซตรอบสอบ

หน้า `/admin/rounds` มีปุ่ม `รีเซตรอบ` สำหรับรอบที่เปิด/ปิดแล้วแต่ยังไม่มีข้อมูลจริงผูกอยู่

ใช้ได้เมื่อรอบนั้นยังไม่มี:

- submission
- attempt
- schedule
- exception

ถ้ามีข้อมูลจริงแล้ว ระบบจะไม่ให้ reset เพื่อรักษา evidence trail

## ขั้นตอนทดสอบที่แนะนำ

1. Admin เปิดรายวิชาใหม่
2. Import นักศึกษาชุดเล็ก 2-3 คน
3. ทดสอบ Student profile → project → advisor request
4. Teacher approve advisor request
5. Admin confirm project/advisor
6. เปิด Proposal round
7. Student submit Proposal
8. Teacher ให้ comment/score
9. Admin ปิด Proposal และตัดสินผล
10. Assign committee
11. เปิด Progress 1 แล้วทดสอบ schedule/score
12. ทำต่อ Progress 2 → Final → Report → Advisor score → Closeout
13. ถ้าต้องเริ่มใหม่ กด `ล้างข้อมูลทดสอบรายวิชานี้`

## ข้อควรระวัง

- ใช้เฉพาะช่วงที่ยังไม่มีข้อมูลจริง
- ก่อนรับข้อมูลจริง ให้ปิด `ENABLE_ADMIN_TEST_TOOLS`
- ไม่ควรรัน demo seed หรือ e2e กับ production database
- ถ้าต้องเก็บข้อมูลทดสอบไว้ตรวจ bug ให้สร้าง course offering ใหม่แทนการล้างทันที
