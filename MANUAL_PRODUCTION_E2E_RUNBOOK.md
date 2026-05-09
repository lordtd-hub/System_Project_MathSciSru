# คู่มือทดสอบ Production E2E สำหรับ Limited Pilot

ระบบบริหารจัดการรายวิชาโครงงานคณิตศาสตร์ / สถิติ  
Project Presentation, Feedback & Evidence System

วัตถุประสงค์ของเอกสารนี้คือใช้ทดสอบ production จริงแบบ manual ตั้งแต่ login จนถึง project เป็น `COMPLETED` และ export evidence สำหรับ QA/AUN-QA ก่อนขยาย pilot เป็น 2-3 นักศึกษา

> ข้อกำหนดสำคัญ: ระหว่างทดสอบนี้ให้ freeze การพัฒนาและการแก้ workflow ชั่วคราว หากพบปัญหาให้บันทึกใน issue log ก่อน แล้วค่อยตัดสินใจแก้เป็น patch แยก

## 1. ข้อมูลก่อนเริ่มทดสอบ

| รายการ | ค่า/ผู้รับผิดชอบ | หมายเหตุ |
| --- | --- | --- |
| วันที่ทดสอบ |  |  |
| ผู้ประสานงานทดสอบ |  |  |
| Production URL |  | ใช้ URL production เท่านั้น ไม่ใช้ preview/local |
| Admin account |  | บัญชี Google จริง |
| Teacher account |  | `@sru.ac.th` |
| Student account |  | `{student_code}@student.sru.ac.th` |
| Course offering |  | เช่น ภาคเรียนที่ 1 ปีการศึกษา 2568 |
| Pilot student roster |  | แนะนำเริ่ม 1 คน |
| Rubric baseline |  | ยืนยันว่ามี rubric ตามรอบที่ใช้ |
| Browser/device Admin |  |  |
| Browser/device Teacher |  |  |
| Browser/device Student |  |  |
| ผู้บันทึกผล |  |  |

ผลรวมก่อนเริ่ม:

| Check | Pass/Fail | Notes |
| --- | --- | --- |
| ข้อมูลบัญชีครบ |  |  |
| นักศึกษา pilot ระบุชัดเจน |  |  |
| course offering ไม่ปนกับข้อมูล demo |  |  |
| ทีมเข้าใจว่าจะไม่ลบ/แก้ DB โดยตรง |  |  |

## 2. Pre-test environment checklist

| ขั้นตอน | Expected result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| ตรวจ Vercel Production deployment | สถานะ Ready |  |  |
| เปิด Production URL | หน้าแรกโหลดได้ |  |  |
| ตรวจ Google OAuth | ปุ่ม/flow login ใช้งานได้ |  |  |
| ตรวจ env vars | `AUTH_SECRET`, `AUTH_URL`, Google OAuth, `INITIAL_ADMIN_EMAIL`, `AUTH_TRUST_HOST` ถูกต้อง |  |  |
| ตรวจ production DB | เชื่อมต่อฐานข้อมูล production ที่ต้องการ |  |  |
| ตรวจไม่มี demo data สับสน | course/student pilot แยกจาก demo ชัดเจน |  |  |
| เข้า `/admin/evidence` ด้วย Admin | เห็น Evidence & AUN-QA module |  |  |
| เข้า `/dev-login` บน production | ต้องเห็นว่า disabled หรือเข้าใช้งานไม่ได้ |  |  |

หมายเหตุปัญหา:

```text

```

## 3. Admin setup test

| ขั้นตอน | Expected result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Admin login ด้วย Google | เข้า dashboard `/admin` ได้ |  |  |
| ตรวจ dashboard | เห็น action queue และเมนูหลัก |  |  |
| เปิด/ตรวจ course offering | course offering ถูกต้องและ active |  |  |
| ถ้ายังไม่มี course offering ให้สร้าง | สร้างสำเร็จ ไม่ซ้ำ |  |  |
| import roster นักศึกษา 1 คน | Student และ Project ถูกสร้างใน course offering นี้ |  |  |
| ตรวจ `/admin/students` | เห็นนักศึกษา pilot |  |  |
| ตรวจ teacher profile | มี teacher profile ที่จะใช้ทดสอบ |  |  |
| approve/link teacher claim ถ้าจำเป็น | Teacher ได้สิทธิ์ TEACHER |  |  |
| เปิดรอบที่เกี่ยวข้องตาม workflow | รอบเปิดตามลำดับที่ระบบอนุญาต |  |  |

ข้อมูลที่ต้องบันทึก:

| รายการ | ค่า |
| --- | --- |
| Course offering ID/name |  |
| Student code |  |
| Student project ID/title |  |
| Teacher name/account |  |

หมายเหตุปัญหา:

```text

```

## 4. Teacher setup test

| ขั้นตอน | Expected result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Teacher login ด้วย Google | เข้า `/teacher` ได้ หรือเห็น claim flow |  |  |
| ถ้ายังไม่ linked ให้ claim profile | สร้าง claim และรอ Admin approve |  |  |
| Admin approve claim | Teacher กลับเข้า dashboard ได้ |  |  |
| ตรวจ teacher dashboard | เห็นงานที่เกี่ยวข้อง/ไม่มี error |  |  |
| ตรวจ action ที่คาดว่าจะใช้ | advisor request, scoring, report review, advisor score พร้อมตามสถานะ |  |  |

หมายเหตุปัญหา:

```text

```

## 5. Student workflow test

| ขั้นตอน | Expected result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Student login ด้วย Google | เข้า `/student` ได้เฉพาะ project ของตนเอง |  |  |
| กรอก student profile | สถานะไปขั้น Draft หรือพร้อมเริ่มหัวข้อ |  |  |
| เปิด `/student/origin` หรือหน้า project | เห็นแบบฟอร์มเสนอหัวข้อ |  |  |
| กรอก project draft/origin | บันทึกได้ ไม่มี raw HTML error จากข้อมูลปกติ |  |  |
| เลือก/request advisor | สร้าง advisor request |  |  |
| ตรวจ dashboard student | เห็นสถานะรอ advisor/admin ตาม workflow |  |  |
| ส่ง proposal เมื่อระบบเปิดให้ส่ง | Proposal submission/version/timeline ถูกสร้าง |  |  |

ข้อความทดสอบที่แนะนำ:

- ใช้ Markdown ปกติ เช่น `**หัวข้อสำคัญ**`
- ใช้ LaTeX ปกติ เช่น `$x_{n+1}=f(x_n)$`
- ห้ามใช้ข้อมูลลับหรือข้อมูลส่วนบุคคลเกินจำเป็น

หมายเหตุปัญหา:

```text

```

## 6. Advisor/Admin approval test

| ขั้นตอน | Expected result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Teacher เปิด advisor request | เห็นคำขอของนักศึกษา pilot |  |  |
| Teacher approve advisor request | สถานะ request เป็น approved |  |  |
| ตรวจ student dashboard | เห็นผลการ approve |  |  |
| Admin เปิด dashboard/admin approval | เห็น project ที่รอ confirm |  |  |
| Admin approve/confirm project | Project ไปขั้นถัดไปตาม Lifecycle v2 |  |  |
| ตรวจ timeline/status history | มีหลักฐาน advisor/admin approval |  |  |

หมายเหตุปัญหา:

```text

```

## 7. Proposal/scoring workflow test

| ขั้นตอน | Expected result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Admin ตรวจ/เปิด Proposal round | รอบพร้อม scoring/review |  |  |
| Teacher เปิด proposal scoring | เห็น submission ของ student |  |  |
| Teacher ให้คะแนน Proposal | score/comment/decision บันทึกได้ |  |  |
| กรณี REVISE/FAIL ใส่ reason | ระบบบังคับ reason ตามกฎ |  |  |
| Admin เปิด `/admin/proposals` | เห็นคะแนน/สถานะ review |  |  |
| Admin final decision | บันทึกผลได้ |  |  |
| ตรวจ student feedback/status | เห็นสถานะ/feedback ตามที่ระบบอนุญาต |  |  |
| ตรวจ project status | ไป `TOPIC_APPROVED` หรือสถานะถัดไปที่ถูกต้อง |  |  |

หมายเหตุปัญหา:

```text

```

## 8. Progress/Final/Report workflow test

| ขั้นตอน | Expected result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Admin assign committee | Project เข้า `IN_PROGRESS` |  |  |
| Admin เปิด Progress 1 round | รอบเปิดตาม eligibility |  |  |
| Student เสนอ/บันทึก schedule หรือหลักฐานที่เกี่ยวข้อง | บันทึกได้ |  |  |
| Teacher ให้คะแนน Progress 1 | มี score evidence |  |  |
| Admin เปิด Progress 2 round | รอบเปิดตามลำดับ |  |  |
| Teacher ให้คะแนน Progress 2 | มี score evidence |  |  |
| Admin เปิด Final Presentation round | รอบเปิดตามลำดับ |  |  |
| Teacher ให้คะแนน Final Presentation | มี score evidence |  |  |
| Student submit report version | ReportVersion ถูกสร้าง |  |  |
| Teacher review report | PASS หรือ revision ถูกบันทึก |  |  |
| ถ้า revision ให้ Student ส่งใหม่ | version ใหม่และ review ใหม่ถูกต้อง |  |  |
| Report approved | Project เข้าสู่ report approved / advisor scoring stage |  |  |
| Advisor submit advisor score | AdvisorScore ถูกบันทึก |  |  |

หมายเหตุปัญหา:

```text

```

## 9. Closeout test

| ขั้นตอน | Expected result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Admin เปิด `/admin/closeout` | เห็น project ที่พร้อม closeout |  |  |
| ตรวจ checklist closeout | Progress 1, Progress 2, Final, Report, Advisor score ครบ |  |  |
| Admin closeout | Project status เป็น `COMPLETED` |  |  |
| ตรวจ dashboard Admin | project ไม่ค้างในงานที่ต้องทำ |  |  |
| ตรวจ student dashboard | เห็นสถานะ completed หรือสถานะจบงาน |  |  |
| ตรวจ warning missing evidence | ไม่มี warning ที่ขัดกับงานที่ทำครบ |  |  |

หมายเหตุปัญหา:

```text

```

## 10. Evidence/AUN-QA test

| ขั้นตอน | Expected result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Admin เปิด `/admin/evidence` | หน้าโหลดได้และเป็น Admin-only |  |  |
| เลือก course offering ที่ทดสอบ | เห็น summary ของ course นี้ |  |  |
| ตรวจ project evidence row | student/project/status ถูกต้อง |  |  |
| ตรวจ evidence completeness | score/report/advisor/timeline/status count สอดคล้อง workflow |  |  |
| Export project evidence CSV | ดาวน์โหลดได้ เปิดใน Excel ได้ |  |  |
| Export timeline CSV | ดาวน์โหลดได้ เปิดใน Excel ได้ |  |  |
| Export scores CSV | ดาวน์โหลดได้ เปิดใน Excel ได้ |  |  |
| Export reports CSV | ดาวน์โหลดได้ เปิดใน Excel ได้ |  |  |
| Export audit CSV | ดาวน์โหลดได้และระบุ global scope |  |  |
| Export XLSX ทุกชนิดที่ต้องใช้ | เปิดใน Excel ได้ |  |  |
| ตรวจ Thai text | อ่านภาษาไทยได้ ไม่เป็น mojibake |  |  |
| ตรวจ columns | header/column ตรงกับ evidence ที่ต้องใช้ |  |  |
| ตรวจ formula injection | cell ที่ขึ้นต้นอันตรายถูก escape หากมีข้อมูลทดสอบที่ปลอดภัย |  |  |

การทดสอบ dangerous text:

- ทำเฉพาะเมื่อปลอดภัยและเป็นข้อมูล pilot เท่านั้น
- ตัวอย่าง: ใส่ comment ที่ขึ้นต้นด้วย `=HYPERLINK("http://evil.test")` ใน field ที่ไม่กระทบ workflow
- หลัง export ต้องไม่ execute เป็นสูตรใน Excel
- หากไม่มั่นใจ ให้ข้ามและอ้างอิง automated test แทน

หมายเหตุปัญหา:

```text

```

## 11. Mobile smoke test

ทดสอบบนมือถือจริงหรือ browser device mode อย่างน้อย 1 รอบ

| Role/page | Expected result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Admin dashboard mobile | action queue อ่านได้ ไม่ล้นจอ |  |  |
| Admin evidence mobile | summary อ่านได้ export controls เห็นได้ |  |  |
| Teacher dashboard mobile | งานที่ต้องทำ scan ได้ |  |  |
| Teacher scoring/review page mobile | อ่านได้ แต่ถ้ายากให้บันทึกว่าแนะนำ desktop |  |  |
| Student dashboard mobile | เห็น next action ชัด |  |  |
| Student submission page mobile | กรอกข้อมูลพื้นฐานได้ |  |  |
| Header/role switch/logout mobile | ไม่กินพื้นที่เกินไป |  |  |

หมายเหตุปัญหา:

```text

```

## 12. Pass/Fail summary

| Severity | Criteria | Count | Notes |
| --- | --- | --- | --- |
| Critical blocker | login ไม่ได้, data ผิด project, auth/role ผิด, workflow ไปต่อไม่ได้, evidence export ใช้ไม่ได้ |  |  |
| High issue | ทำงานหลักได้แต่มี workaround เสี่ยง หรือข้อมูลหลักฐานไม่ครบ |  |  |
| Medium issue | UX/wording/step confusing แต่ไม่ทำให้ข้อมูลผิด |  |  |
| Low issue | cosmetic, layout, ข้อความเล็กน้อย |  |  |

ผลสรุป:

| รายการ | Pass/Fail | Notes |
| --- | --- | --- |
| Login ทุก role ผ่าน |  |  |
| Workflow 1 project ถึง `COMPLETED` |  |  |
| Evidence export CSV/XLSX ผ่าน |  |  |
| Mobile smoke test ผ่านพอใช้ |  |  |
| ไม่มี critical blocker |  |  |
| Final Go/No-Go สำหรับ pilot 2-3 คน |  |  |

คำตัดสิน:

- [ ] Go สำหรับเพิ่มเป็น 2-3 นักศึกษา
- [ ] Go แบบมีเงื่อนไข ต้องแก้รายการที่ระบุ
- [ ] No-Go ชั่วคราว ต้องแก้ blocker ก่อน

เหตุผลประกอบคำตัดสิน:

```text

```

## 13. Issue log table

| Date/time | Role | Page | Action | Expected result | Actual result | Severity | Screenshot/link | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |

Severity guide:

- Critical: หยุด pilot ทันที
- High: ต้องแก้ก่อนขยาย pilot
- Medium: บันทึกและจัดลำดับแก้หลัง limited pilot ได้
- Low: cosmetic หรือปรับปรุงภายหลัง

## Final sign-off

| Role | Name | Decision | Signature/date |
| --- | --- | --- | --- |
| Admin lead |  |  |  |
| Teacher representative |  |  |  |
| QA/programme staff |  |  |  |
| Technical owner |  |  |  |
