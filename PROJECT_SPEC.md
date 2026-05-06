# System Requirement Specification

## 1. System name

**Project Presentation, Feedback & Evidence System**

ภาษาไทย: ระบบประเมินการนำเสนอและจัดเก็บหลักฐานเส้นทางโครงงาน

## 2. Course context

Course title: Mathematical Project Course

The system supports presentation assessment for a mathematical project course. Each student works on an individual project.

The course has presentation-related assessment rounds:

| Round | Weight |
|---|---:|
| Proposal Presentation | 10% |
| Progress Presentation 1 | 10% |
| Progress Presentation 2 | 10% |
| Final Presentation | 10% |
| Total in this system | 40% |

Report / Article and Advisor Assessment numeric scoring are outside this system. The current app includes a lightweight report approval loop for evidence and lifecycle closure, but it does not score the report/article.

## 3. MVP 1 scope

Current baseline note: this section describes the original MVP 1 slice. The implemented Lifecycle v2 baseline now extends through self-scheduling, Progress 1 scoring, Progress 2 scoring, Final Presentation scoring, report approval, Advisor score 25%, and Admin-only closeout. The Lifecycle v2 sections later in this document are authoritative for current behavior.

Implement only:

1. Authentication and roles
2. Student import from Excel
3. Seed teacher master data
4. Teacher account claim workflow
5. Academic year / term setup
6. Project Origin Form
7. Proposal Submission
8. Proposal checklist scoring
9. Proposal pass/revision/not-pass decision
10. Admin final proposal decision
11. Feedback release
12. Timeline / evidence trail

Do not implement yet:
- Progress 1
- Progress 2
- Final Presentation
- External committee magic link
- Full AUN-QA export
- Report / Article scoring
- Advisor assessment scoring

## 4. Roles

### Admin

- Manage academic years and terms
- Import students
- Manage teacher profiles
- Approve/reject teacher account claims
- Open/close assessment rounds
- View proposal scoring summary
- Make final proposal decision
- Release feedback to students
- Unlock submissions if needed
- View evidence trail

### Student

- Login using `{student_code}@student.sru.ac.th`
- Submit Project Origin Form
- Submit Proposal Submission
- Edit until deadline
- View feedback after Admin release

### Teacher

- Login using `@sru.ac.th`
- Claim teacher profile on first login
- Wait for Admin approval
- Score proposal after approval
- Submit checklist score, comments, and decision

### Advisor

Advisor is a project-level role. Advisor does not score presentations by default but can see feedback after the round is closed.

For MVP 1, advisor can be a tentative advisor in Project Origin and Proposal. Full advisor dashboard can be implemented later.

## 5. Authentication

### Student login rule

Student email is generated from student code:

```text
{student_code}@student.sru.ac.th
```

Import file contains:

```text
student_code
first_name_th
last_name_th
```

The system derives:

```text
email = student_code + "@student.sru.ac.th"
```

### Teacher login rule

Teacher uses Google account with:

```text
@sru.ac.th
```

Teacher profiles are seeded without email first.

First login flow:

```text
Teacher logs in with Google @sru.ac.th
→ system sees no linked teacher profile
→ teacher selects their name from unclaimed profile list
→ create pending teacher account claim
→ Admin approves
→ teacher profile is linked to that Google account/email
```

Until approved, the account sees only a pending approval screen.

## 6. Academic year and term

Use Thai display format:

```text
ภาคเรียนที่ 1 ปีการศึกษา 2568
ภาคเรียนที่ 2 ปีการศึกษา 2568
ภาคฤดูร้อน ปีการศึกษา 2568
```

Suggested database fields:

```text
academic_year = 2568
term_type = SEMESTER_1 | SEMESTER_2 | SUMMER
display_name = "ภาคเรียนที่ 1 ปีการศึกษา 2568"
```

## 7. Student import

Excel columns:

| Column | Required |
|---|---:|
| student_code | yes |
| first_name_th | yes |
| last_name_th | yes |

Validation:
- `student_code` is required
- `student_code` must be unique in the selected course offering
- generate email automatically
- generated email must be unique
- no section needed in MVP

## 8. Teacher master data

Seed these internal teachers:

1. ผศ.ดร.สิทธิโชค ทรงสอาด
2. ผศ.กันญารัตน์ หนูชุม
3. อ.กันยากร อ่อนรักษ์
4. ผศ.ดร.เกตุกนก หนูดี
5. ผศ.จิราพร เสนจันทร์
6. อ.ดร.ธนนต์ ก่อเกียรติสกุล
7. อ.ศุภชัย ดำคำ
8. ผศ.สุจารี ดำศรี
9. อ.ดร.อรรถกร ศักดา
10. ผศ.อรวรรณ สืบเสน
11. ผศ.อัญชุลี ณ ตะกั่วทุ่ง

Academic prefix must be editable and separate from name.

Do not store `ผศ.ดร.สิทธิโชค ทรงสอาด` as one string only.

Store fields such as:

```text
academic_prefix = "ผศ.ดร."
first_name_th = "สิทธิโชค"
last_name_th = "ทรงสอาด"
```

## 9. Project Origin Form

Students must complete this before Proposal Submission.

Fields:

| Field | Required |
|---|---:|
| initial_project_title_th | yes |
| initial_project_title_en | no |
| source_type | yes |
| reason_for_topic | yes |
| expected_math_area | yes |
| tentative_advisor_id | no |
| consultation_summary | yes |
| initial_references | yes |
| material_link | yes |
| student_declaration | yes |

Source types:

```text
STUDENT_INITIATED
ADVISOR_SUGGESTED
TOPIC_BANK
COURSEWORK_EXTENSION
RESEARCH_EXTENSION
COMMUNITY_OR_INDUSTRY_PROBLEM
REVISED_FROM_FAILED_PROPOSAL
OTHER
```

Allowed material link domains:
- `drive.google.com`
- `docs.google.com`
- `classroom.google.com`

## 10. Proposal Submission

Fields:

| Field | Required |
|---|---:|
| project_title_th | yes |
| project_title_en | no |
| abstract_of_talk | yes |
| motivation_background | yes |
| objectives | yes |
| proposed_methods | yes |
| expected_outcomes | yes |
| timeline | yes |
| questions_for_teachers | no |
| material_link | yes |
| student_declaration | yes |

Text fields should support Markdown + LaTeX.

Supported math examples:
- Inline: `$x^2 + y^2 = z^2$`
- Display: `$$\int_a^b f(x)\,dx$$`

Raw HTML from students is not allowed.

## 11. Submission version history

Students can edit until deadline.

Each save/submit should keep version history:
- version number
- content
- material link
- saved/submitted timestamp
- edited by

After deadline, submission becomes locked.

Admin may unlock with audit log.

## 12. Proposal scoring

All active internal teachers can score Proposal.

Missing teacher scores:
- exclude from average
- still show missing list to Admin
- do not show missing teacher names to students

Each teacher uses checklist scoring:
- checked = full points for item
- unchecked = 0
- no N/A in MVP

Each teacher must select one decision:

```text
PASS
PASS_WITH_REVISION
NOT_PASS
```

Reason is required for:
- `PASS_WITH_REVISION`
- `NOT_PASS`

## 13. Proposal final decision

The system displays:
- average score
- number of submitted scores
- missing teachers
- vote counts:
  - pass count
  - revision count
  - not pass count
- reasons/comments

Admin/meeting manually chooses final decision:
- PASS
- PASS_WITH_REVISION
- NOT_PASS

The system must not auto-decide final result.

## 14. Re-proposal future path

If Proposal final decision is `NOT_PASS`:

1. Admin appoints advisor + small committee
2. Student submits Re-proposal
3. Small committee evaluates Re-proposal
4. If passed, project enters Progress 1
5. Admin can open re-proposal attempts as needed
6. No fixed limit on attempts

For MVP 1, do not implement full re-proposal workflow, but design database to support multiple assessment attempts.

## 15. Feedback visibility

| Round | Student sees evaluator name? |
|---|---:|
| Main Proposal | no |
| Re-proposal | yes |
| Progress 1 | yes |
| Progress 2 | yes |
| Final | yes |

For MVP 1:
- Proposal feedback is anonymous to student
- Advisor can see feedback after round is closed
- Student sees feedback only after Admin release

## 16. Evidence trail for AUN-QA

Store timeline events for:

- Project origin submitted
- Proposal submitted
- Proposal scoring opened
- Teacher score submitted
- Proposal closed
- Admin final decision
- Feedback released
- Submission unlocked
- Teacher account claim approved/rejected

The evidence trail should answer:

```text
หัวข้อเกิดขึ้นอย่างไร
นักศึกษาส่งข้อมูลเมื่อไหร่
ใครประเมิน
ใช้ rubric อะไร
ให้ feedback อะไร
Admin สรุปผลอย่างไร
นักศึกษาได้รับ feedback เมื่อไหร่
```

## 17. Final Presentation policy for future

Final Presentation rubric must assess only:
- presented results
- mathematical understanding
- presentation/communication
- Q&A
- overall completion

Do not include report/article quality in Final Presentation rubric.
# Project Lifecycle v2 Update

ส่วนนี้เป็นข้อกำหนดล่าสุดของ workflow โครงงาน ระบบใช้ Lifecycle v2 เป็น workflow หลักเท่านั้น ปัจจุบัน self-scheduling, Progress 1 scoring, Progress 2 scoring, Final Presentation scoring, report approval loop ถึงสถานะ `REPORT_APPROVED`, Advisor score 25%, และ Admin-only closeout ถึง `COMPLETED` ใช้งานได้แล้ว ส่วน external committee magic link, AUN-QA export และ production deployment ยังอยู่ใน roadmap ถัดไป

## สถานะโครงงาน

1. `STUDENT_PROFILE` - นักศึกษากรอกข้อมูลส่วนตัวให้ครบ
2. `DRAFT` - นักศึกษาสร้างโครงงานและเลือกอาจารย์ที่ปรึกษา
3. `PENDING_ADVISOR` - รอ advisor อนุมัติ ถ้าปฏิเสธให้กลับไป `DRAFT` และระบบต้องรองรับ reminder 7 วัน
4. `PENDING_ADMIN` - รอ Admin ยืนยันโครงงานและ advisor
5. `PROPOSAL_PENDING` - นักศึกษาแนบ abstract และลิงก์ Google Drive/Classroom รอ Admin จัดรอบ Proposal แบบ batch
6. `PROPOSAL_REVIEW` - อาจารย์ภายในทุกคนประเมินและ vote `PASS` / `REVISE` / `FAIL`
7. `PROPOSAL_ADMIN_DECISION` - Admin ตัดสินผลสุดท้ายด้วยตนเอง
8. `TOPIC_APPROVED` - หัวข้อผ่านแล้ว Admin แต่งตั้ง `HEAD` และ `MEMBER`; advisor เป็น `ADVISOR` อัตโนมัติ
9. `IN_PROGRESS` - ครอบคลุม `PROGRESS_1`, `PROGRESS_2`, `FINAL_PRESENT` โดยนักศึกษาเสนอวัน เวลา ห้อง และกรรมการทุกคนต้อง approve ตาราง
10. `FINAL_DONE` - Final presentation เสร็จและคะแนนครบ จากนั้นเริ่ม report approval loop
11. `REPORT_REVIEW` - นักศึกษา upload report version ด้วย Google Drive link และ reviewer ให้ `PASS`/`FAIL` พร้อม comment
12. `REPORT_APPROVED` - reviewer ทุกคนผ่านแล้ว
13. `ADVISOR_SCORING` - advisor กด "ปิดเล่ม" แล้วคะแนน advisor 25% ถูก unlock
14. `COMPLETED` - Admin กด completed เมื่อระบบพร้อม

## Proposal v2

- Student เห็น comments ทันที
- Student ไม่เห็นคะแนน Proposal
- Student เห็นชื่ออาจารย์ผู้ comment
- ถ้า `FAIL` vote มีอย่างน้อย 50% ระบบต้อง alert Admin
- Admin ตัดสินผลสุดท้ายเอง:
  - `PASS` -> `TOPIC_APPROVED`
  - `FAIL` -> `DRAFT` โดยเก็บประวัติไว้
  - `REVISE` -> กลับ `DRAFT` หรือ `PROPOSAL_PENDING` โดยเก็บประวัติไว้

## Progress / Final schedule and scoring status

- `PROGRESS_1` และ `PROGRESS_2` scoring ใช้งานได้สำหรับ HEAD/MEMBER ที่ได้รับแต่งตั้ง
- `FINAL_PRESENT` scoring ใช้งานได้แล้วสำหรับ HEAD/MEMBER ที่ได้รับแต่งตั้ง แต่ยังไม่เปลี่ยน lifecycle อัตโนมัติ
- นักศึกษาเสนอวัน เวลา ห้อง
- กรรมการเห็น dashboard notification และ email-ready notification
- ถ้ากรรมการทุกคน approve ให้ schedule confirmed
- ถ้ามีคน reject นักศึกษาต้องเสนอ schedule ใหม่

## Report Approval Loop

1. นักศึกษา upload report version 1 ด้วย Google Drive link ใหม่
2. reviewer แต่ละคนกด `PASS` หรือ `FAIL` พร้อม comment
3. reviewer ที่ผ่านแล้วไม่ต้อง review version ใหม่
4. ถ้ามี reviewer fail นักศึกษาส่ง version ถัดไปด้วย Drive link ใหม่
5. เมื่อ reviewer ทุกคน pass ให้ unlock advisor final gate
6. advisor กด "ปิดเล่ม"
7. advisor score 25% unlock
8. advisor ส่งคะแนน `ADVISOR`
9. Admin ตรวจสอบ closeout eligibility แล้วกด `COMPLETED`

Current implementation note:

- Report approval loop steps 1-5 are functional through `/student/report` and `/teacher/reports`.
- Student report submission is allowed at `FINAL_DONE` and moves the project to `REPORT_REVIEW`.
- A reviewer `FAIL` keeps the project in `REPORT_REVIEW` and allows student resubmission as a new `ReportVersion`.
- Required active `HEAD`/`MEMBER` reviewer approvals move the project to `REPORT_APPROVED`.
- Advisor score 25% is functional after `REPORT_APPROVED` and moves the project to `ADVISOR_SCORING`.
- Admin closeout is functional at `/admin/closeout`; it is the only app workflow that moves a project to `COMPLETED`.

## Advisor Score 25%

- Advisor score is separate from presentation scores and is not tied to a course-level `AssessmentRound`.
- Only the project advisor can submit Advisor score.
- Active `HEAD`/`MEMBER` cannot submit Advisor score unless they are also the advisor.
- Advisor score is available only after the report reaches `REPORT_APPROVED`.
- Submitting Advisor score moves `REPORT_APPROVED` to `ADVISOR_SCORING`.
- Re-submitting updates the same `AdvisorScore` row for the project.
- The system stores a 100-point Advisor rubric score that can later be weighted as 25% in final aggregation.
- The current Advisor rubric is:
  - Responsibility / punctuality: 25
  - Research process and independence: 25
  - Problem-solving and improvement: 25
  - Communication with advisor: 15
  - Overall professionalism: 10
- Advisor score submission does not mark the project `COMPLETED`.

## Final Closeout / Completion

- `COMPLETED` is Admin-only.
- Advisor score moves the project to `ADVISOR_SCORING`, not `COMPLETED`.
- Admin may mark a project `COMPLETED` only after the server-side eligibility check confirms:
  - current project state is `ADVISOR_SCORING`
  - Progress 1 score exists
  - Progress 2 score exists
  - Final Presentation score exists
  - report approval evidence exists
  - Advisor score exists
  - no active unresolved report revision is pending on the latest report version
- Completion writes status history, timeline evidence, and audit log.
- The system does not compute a final course grade during closeout.
- Production deployment work is not part of this closeout workflow.

## Visibility v2

| Assessment | Student visibility |
|---|---|
| PROPOSAL | เห็น comments ทันที, ไม่เห็น score, เห็นชื่ออาจารย์ |
| PROGRESS_1 | เห็น comments และ scores ทันที, เห็นชื่ออาจารย์ |
| PROGRESS_2 | เห็น comments และ scores ทันที, เห็นชื่ออาจารย์ |
| FINAL_PRESENT | เห็น comments และ scores ทันที, เห็นชื่ออาจารย์ |
| PROJECT_REPORT | เห็น comments และ pass/fail ทันที; score เห็นทันทีถ้ามีการ implement |
| ADVISOR | เห็น comments และ score ทันที |

## Committee roles v2

- `ADVISOR`
- `HEAD`
- `MEMBER`
- `EXTERNAL_MEMBER`

Advisor ไม่ score presentation โดย default ส่วน `HEAD` และ `MEMBER` score presentation
## Course-Level Assessment Rounds

Major assessment rounds are course-level batch rounds, not per-project rounds.

- Admin opens one round per course offering for `PROPOSAL`, `PROGRESS_1`, `PROGRESS_2`, and `FINAL_PRESENTATION`.
- Eligible projects participate under the shared course-level `AssessmentRound`.
- Opening/closing a round must use the shared `courseOfferingId + roundType` record; the system must not create an `AssessmentRound` for each project.
- A project that fails Proposal returns to `DRAFT` as the same project; status history/timeline stores the evidence.
- Closing Proposal does not automatically open Progress 1. Admin must finish Proposal final decisions, assign ADVISOR/HEAD/MEMBER, then open the Progress 1 course-level round.
- Re-runs, revisions, delayed students, rejected schedules, medical/leave issues, and other special handling should use project-level attempts/statuses/exceptions under the course-level round.
- Dashboard project cards show current projects once. Historical attempts and status changes belong in timeline/history, not duplicate current-project cards.

## Phase 2A Self-Scheduling

- Student self-scheduling is functional for `PROGRESS_1`, `PROGRESS_2`, and `FINAL_PRESENTATION`.
- Scheduling is allowed only when the project is `IN_PROGRESS`, the course-level round is open, and the student owns the project through the imported roster.
- Scheduling uses the shared `AssessmentRound` for the course offering. It must not create per-project assessment rounds.
- Re-submitting a schedule for the same project and round updates the existing schedule row.
- Teacher/Admin schedule pages are read-only monitoring views in this phase.
- Schedule approval automation beyond the existing skeleton remains out of scope.

## Progress 1 / Progress 2 / Final Presentation Scoring

Progress 1, Progress 2, and Final Presentation scoring are functional for assigned committee teachers only.

| Criterion | Max |
|---|---:|
| Progress | 30 |
| Problem-solving | 20 |
| Research/results | 20 |
| Presentation | 20 |
| Overall | 10 |

- Only active `HEAD` or `MEMBER` committee assignments can submit Progress 1 / Progress 2 scores.
- Total score is computed server-side.
- Re-submission by the same scorer updates the existing score submission.

Final Presentation uses this rubric:

| Criterion | Max |
|---|---:|
| Research/results | 30 |
| Execution/problem-solving | 20 |
| Presentation | 20 |
| Overall | 10 |

- Final Presentation criteria total 80 raw points.
- The system stores the normalized score as `raw / 80 * 100` in `ScoreSubmission.totalScore` so it remains consistent with the existing 100-point score storage.
- No hidden extra criterion is added.
- Final Presentation scoring records scores only; it does not start report review, mark `FINAL_DONE`, mark `COMPLETED`, or unlock Advisor score automatically.
