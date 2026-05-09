# Final Pilot Readiness Review

ระบบบริหารจัดการรายวิชาโครงงานคณิตศาสตร์ / สถิติ  
Project Presentation, Feedback & Evidence System

วันที่ทบทวน: 9 พฤษภาคม 2026  
สถานะที่ทบทวน: หลังชุด pre-pilot security hardening ล่าสุด

## 1. Executive summary

ข้อเสนอแนะหลัก: **Go สำหรับ limited pilot เท่านั้น**

ระบบพร้อมสำหรับ pilot ขนาดเล็ก 1-3 นักศึกษา ภายใต้การกำกับของ Admin และอาจารย์กลุ่มเล็ก โดยควรใช้ข้อมูลจริงแบบจำกัดหรือข้อมูล pilot ที่ระบุชัดเจนก่อนเปิดใช้งานกับทั้งรายวิชา

ไม่พบ blocker ระดับหยุด pilot จากสถานะล่าสุดของระบบและชุด hardening ที่ทำเสร็จแล้ว อย่างไรก็ตาม ยังไม่ควรประกาศว่าเป็นระบบ production เต็มรูปแบบสำหรับนักศึกษาทั้งรุ่นจนกว่าจะผ่าน manual test ตาม checklist ในเอกสารนี้

เงื่อนไข Go:

- ใช้กับ 1 course offering ที่กำหนดไว้ชัดเจน
- เริ่มจากนักศึกษา 1-3 คน
- ใช้บัญชี Google จริงของ Admin / Teacher / Student
- เดิน workflow จนครบอย่างน้อย 1 project
- export evidence หลังจบ workflow สำคัญ
- ไม่ลบหรือแก้ฐานข้อมูล production โดยตรงระหว่าง pilot

## 2. Current production status

สถานะ deployment ล่าสุด:

- commit ล่าสุดที่ push: `700b7ec security: add pilot rate and size guards`
- Production deployment ล่าสุดขึ้นสถานะ Ready จาก Vercel CLI
- ระบบ build ผ่านหลัง hardening
- test suite ผ่านหลัง hardening

สถานะ repository:

- มีไฟล์เอกสาร/ดีไซน์บางส่วนที่ยัง untracked หรือ modified อยู่ใน working tree
- ไฟล์เหล่านั้นไม่ได้เป็นส่วนหนึ่งของ production commit ล่าสุด
- ไม่พบว่ามี app code ที่ยังค้าง staging สำหรับ pilot review นี้

ข้อควรระวัง:

- ควรหลีกเลี่ยงการ commit ไฟล์ unrelated เช่น design reference, logo draft, หรือเอกสารทดลอง โดยไม่ตั้งใจ
- ก่อน deploy ครั้งถัดไปให้เช็ก `git status --short` ทุกครั้ง

## 3. Completed capabilities

ระบบมี capability หลักสำหรับ pilot แล้ว:

- Google OAuth สำหรับ production login
- บทบาท ADMIN, TEACHER, STUDENT, PENDING_TEACHER
- รองรับ ADMIN • TEACHER dual-role
- teacher claim และ admin approval
- course offering setup
- teacher baseline seed
- student roster import
- Lifecycle v2 ตั้งแต่ student profile ถึง Admin closeout เป็น `COMPLETED`
- advisor request / approval
- proposal submission และ proposal review
- proposal final decision โดย Admin
- committee assignment
- Progress 1 scoring
- Progress 2 scoring
- Final presentation scoring
- report version submission และ report review
- advisor score 25%
- admin closeout
- action-queue dashboard สำหรับ Admin/Teacher
- mobile dashboard ที่กระชับขึ้น
- Evidence & AUN-QA dashboard
- CSV/XLSX evidence exports
- pilot user manual

## 4. Security hardening status

รายการ hardening ที่ทำเสร็จแล้ว:

| Area | Status | Notes |
| --- | --- | --- |
| Export formula injection | Done | CSV/XLSX cell protection ใช้ shared sanitizer |
| JWT role cache TTL | Done | role/capability refresh เมื่อ cache หมดอายุ |
| Login role lookup | Done | ลด broad/full-table role resolution |
| Dev session cookie | Done | signed dev session cookie และ production ยังปิด dev login |
| Redirect query encoding | Done | ใช้ `URLSearchParams` helper ในจุดเสี่ยง |
| Student CSV parsing | Done | ใช้ PapaParse รองรับ quoted fields/Thai/blank lines |
| Admin audit logs | Done | เพิ่ม logs ให้ admin state changes สำคัญ |
| Rate limiting | Done for pilot | in-memory per-instance best-effort |
| Request/body size guards | Done for pilot | guard CSV, markdown/comment, query param |

ข้อจำกัดด้าน security ที่ยอมรับได้สำหรับ pilot:

- rate limiting เป็น in-memory ต่อ server instance ไม่ใช่ distributed quota
- ยังไม่มี external WAF/rate-limit storage เช่น Redis/Upstash
- ยังควร review cookie flags/config ระดับ production อีกครั้งก่อนเปิดวงกว้าง
- ยังควร review sanitizer/KaTeX ordering เป็น security follow-up แยก

## 5. Evidence/AUN-QA readiness

พร้อมสำหรับ pilot QA evidence ในระดับใช้งานจริงแบบจำกัด:

- มี evidence dashboard สำหรับ Admin
- แสดง project evidence completeness
- แสดง timeline/status/audit/score/report/advisor evidence
- export ได้ทั้ง CSV และ Excel
- export มี formula-injection protection
- invalid course offering ไม่ fallback เงียบ
- audit export ระบุ scope เป็น global อย่างชัดเจน
- rubric/evaluation evidence ไม่อ้าง attribution เกินกว่าข้อมูลที่ระบบมี

สิ่งที่ใช้สนับสนุน QA/AUN-QA ได้:

- assessment evidence
- rubric-based scoring evidence
- feedback/revision evidence
- student progression evidence
- completion evidence
- decision/audit trail evidence

ข้อจำกัด:

- ยังไม่มี official CLO/PLO/AUN mapping logic
- audit export ยังเป็น global ไม่ filter ตาม course offering
- exports โหลดข้อมูลใน memory เหมาะกับ pilot scale
- evidence completeness บอกว่ามีหลักฐาน ไม่ได้แทนคำตัดสินทางวิชาการทั้งหมด

## 6. UI/mobile readiness

พร้อมสำหรับ pilot แบบมีผู้ดูแลประกบ:

- Admin/Teacher dashboard ปรับเป็น action-queue/operational console แล้ว
- ปุ่ม/header/mobile controls กระชับขึ้น
- shared tokens/cards/buttons/badges align กับ redesign direction
- mobile ใช้งาน dashboard และ workflow status ได้ดีขึ้น

ข้อจำกัด:

- งาน scoring, import roster, evidence export ยังแนะนำให้ใช้ desktop
- workflow-heavy pages บางหน้าบน mobile ยังเป็น compromise เพื่อรักษา workflow stability
- UI ยังควรถูกสังเกตจากผู้ใช้จริงระหว่าง pilot โดยเฉพาะ wording และ scanability

## 7. Performance readiness

พร้อมสำหรับ pilot 1-3 นักศึกษา:

- dashboard performance ได้รับการปรับปรุงก่อนหน้านี้
- login role lookup ลด full-table scan แล้ว
- import CSV มี size guard
- evidence export เหมาะกับ pilot scale
- build และ test ล่าสุดผ่าน

ข้อจำกัด:

- student import ยังมีบางส่วนที่เป็น sequential upsert เหมาะกับ roster เล็กก่อน
- evidence export ยังไม่ได้ทำ streaming/pagination สำหรับข้อมูลจำนวนมาก
- rate limit in-memory ไม่ใช่ solution สำหรับ traffic สูงหรือหลาย instance แบบเข้มงวด

## 8. Role-by-role readiness

| Role | Readiness | Notes |
| --- | --- | --- |
| ADMIN | Ready for limited pilot | ตั้ง course offering, import, approve claims, manage rounds, final decision, closeout, evidence export |
| TEACHER | Ready for limited pilot | claim profile, advisor request, scoring, report review, advisor score |
| STUDENT | Ready for limited pilot | login, profile, origin, proposal, schedule/report submission, feedback/status tracking |
| PENDING_TEACHER | Ready | จำกัดสิทธิ์ก่อน Admin approve |
| ADMIN • TEACHER | Ready with manual verification | ต้องทดสอบ role switch และ permission จริงก่อน pilot |
| QA staff | Ready via Admin evidence access | ใช้ Admin Evidence & AUN-QA module เพื่อ export หลักฐาน |

## 9. End-to-end workflow readiness

Lifecycle v2 พร้อมสำหรับ pilot แบบเดินครบเส้นทาง:

1. Student profile
2. Draft
3. Advisor approval
4. Admin approval
5. Proposal review
6. Proposal decision
7. Topic approved
8. In progress
9. Progress 1
10. Progress 2
11. Final presentation
12. Report review
13. Report approved
14. Advisor score
15. Admin closeout to `COMPLETED`

เงื่อนไข readiness:

- ต้องทดสอบด้วยบัญชีจริงตาม role
- ต้อง export evidence หลังแต่ละช่วงสำคัญ
- ต้องทดสอบกรณี feedback/report revision อย่างน้อย 1 รอบ ถ้าเวลาพอ

## 10. Pilot blockers

ผลการทบทวน: **ไม่พบ blocker ที่ต้อง No-Go สำหรับ pilot ขนาด 1-3 นักศึกษา**

ไม่มี blocker ต่อไปนี้ในสถานะล่าสุด:

- ไม่มี known auth bypass blocker
- ไม่มี known evidence export formula injection blocker
- ไม่มี known unsigned dev session blocker
- ไม่มี known silent invalid course export fallback
- ไม่มี known workflow-breaking regression จาก hardening ล่าสุด
- ไม่มี known build/test failure หลัง patch ล่าสุด

สิ่งที่ยังต้องทำก่อนนำเข้าข้อมูลนักศึกษาจริง:

- manual test บัญชีจริงครบ role
- manual test course offering จริงหรือ pilot offering
- manual export CSV/XLSX จาก production
- ยืนยันว่า production URL และ environment variables ถูกต้อง

## 11. Acceptable limitations

ข้อจำกัดที่ยอมรับได้สำหรับ limited pilot:

- จำกัด pilot 1-3 นักศึกษา
- evidence export เป็น memory-based
- rate limiting เป็น per-instance best-effort
- audit export ยังเป็น global
- no official CLO/PLO/AUN mapping
- report/article numeric scoring ยังไม่ใช่ scope
- mobile เหมาะสำหรับติดตาม/งานเบา งานหนักยังแนะนำ desktop
- manual cleanup ต้องระวัง production database
- ยังไม่มี automated full production E2E ที่ครอบคลุมทุก browser/device

## 12. Required manual tests before real student import

ต้องทำก่อน import roster จริง:

| Test | Owner | Expected result |
| --- | --- | --- |
| Admin Google login | Admin | เข้า `/admin` ได้ |
| Teacher Google login | Teacher | ถ้ายังไม่ claim ต้องเห็น claim flow |
| Teacher claim approval | Admin + Teacher | หลัง approve Teacher เข้า dashboard/scoring ได้ |
| Student Google login | Student | เข้า dashboard ของตัวเองได้เท่านั้น |
| ADMIN • TEACHER dual-role | Admin/Teacher user | สลับ role และเห็นสิทธิ์ถูกต้อง |
| Create course offering | Admin | course offering active และมี rounds baseline |
| Import 1-3 student roster | Admin | student/project ถูกสร้างถูก course |
| Advisor request flow | Student + Teacher | approve/reject เดิน status ถูกต้อง |
| Admin advisor confirmation | Admin | project ไปขั้นต่อไปถูกต้อง |
| Proposal submission | Student | submission/version/timeline ถูกสร้าง |
| Proposal scoring | Teacher | score/comment/vote ถูกบันทึก |
| Proposal final decision | Admin | status/result/timeline/audit ถูกต้อง |
| Committee assignment | Admin | project เข้า `IN_PROGRESS` |
| Progress 1 score | Teacher | score evidence ถูกบันทึก |
| Progress 2 score | Teacher | score evidence ถูกบันทึก |
| Final presentation score | Teacher | score evidence ถูกบันทึก |
| Report submission/review | Student + Teacher | revision/approval evidence ถูกต้อง |
| Advisor score | Advisor | score 25% ถูกบันทึก |
| Closeout | Admin | project เป็น `COMPLETED` |
| Evidence dashboard | Admin/QA | completeness แสดงถูกต้อง |
| CSV export | Admin/QA | เปิด Excel ได้และไม่มี formula execution |
| XLSX export | Admin/QA | เปิด Excel ได้และ header/Thai text อ่านได้ |
| Mobile dashboard smoke test | Admin/Teacher/Student | dashboard อ่านได้และ action หลักไม่หาย |

## 13. Recommended pilot rollout plan

ลำดับ rollout ที่แนะนำ:

1. Freeze code หลัง commit readiness review
2. เช็ก production URL และ environment variables
3. Admin login ด้วยบัญชีจริง
4. Teacher login/claim ด้วยบัญชี `@sru.ac.th`
5. Student login smoke test ด้วยบัญชี `@student.sru.ac.th`
6. สร้าง course offering pilot หรือรายวิชาจริงที่ระบุชัด
7. Import roster 1 คนก่อน
8. เดิน workflow end-to-end ให้จบ 1 project
9. Export evidence ทั้ง CSV/XLSX
10. เพิ่มนักศึกษาอีก 1-2 คนถ้า scenario แรกผ่าน
11. เก็บ feedback จาก Admin/Teacher/Student/QA staff
12. สรุปปัญหาและจัดลำดับ post-pilot backlog ก่อนเปิดวงกว้าง

ข้อห้ามระหว่าง rollout:

- ห้าม import roster ทั้งรุ่นก่อน smoke test ผ่าน
- ห้ามเปิดให้หลายอาจารย์ใช้งานพร้อมกันก่อน role/claim test ผ่าน
- ห้ามลบ production data โดยไม่ export evidence ก่อน
- ห้ามแก้ฐานข้อมูลโดยตรงเว้นแต่มีแผน rollback ชัดเจน

## 14. Post-pilot backlog

ควรทำหลัง limited pilot:

- sanitizer/KaTeX ordering review
- production cookie/security config review
- distributed rate limiting หากมีผู้ใช้มากขึ้น
- import performance pass สำหรับ roster ใหญ่
- evidence export pagination/streaming สำหรับข้อมูลมาก
- audit consistency pass สำหรับ teacher/student evidence actions ที่เหลือ
- course-scoped audit export ถ้า metadata รองรับปลอดภัย
- better QA/AUN mapping report ถ้าหลักสูตรต้องการ mapping อย่างเป็นทางการ
- mobile workflow polish เพิ่มเติมบน scoring/report-heavy pages
- user-facing error message polish สำหรับ rate limit/size guard
- full production E2E script ที่ใช้บัญชี pilot หรือ seed data แยก
- backup/cleanup SOP สำหรับ production pilot data

## 15. Go / No-Go recommendation

คำแนะนำสุดท้าย: **Go for limited pilot**

ไม่แนะนำให้เปิดทั้งรายวิชาทันที แต่พร้อมเริ่ม pilot ขนาดเล็ก 1-3 นักศึกษา ภายใต้เงื่อนไขว่า manual tests ใน section 12 ต้องผ่านก่อน import ข้อมูลจริงมากกว่ากลุ่ม pilot

Go conditions:

- production deployment เป็น Ready
- Admin/Teacher/Student login จริงผ่าน
- teacher claim flow ผ่าน
- course offering setup ผ่าน
- import roster 1-3 คนผ่าน
- workflow อย่างน้อย 1 project เดินถึง `COMPLETED`
- evidence exports เปิดได้ทั้ง CSV/XLSX
- ผู้ดูแลระบบมีแผนรับ feedback และหยุด rollout หากพบ workflow bug

ถ้า manual tests ข้างต้นไม่ผ่าน ให้ถือเป็น **No-Go ชั่วคราว** จนกว่าจะแก้จุดนั้นและทดสอบซ้ำ
