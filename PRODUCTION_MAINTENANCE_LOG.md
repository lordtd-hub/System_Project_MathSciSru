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
