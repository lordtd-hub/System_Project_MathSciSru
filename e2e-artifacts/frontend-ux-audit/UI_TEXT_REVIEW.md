# UI Text Review

Goal: identify visible text that feels like user language versus programmer/internal language. No code changes were made in this audit.

## Good User-Facing Text

- `/student`: "สิ่งที่ต้องทำต่อไป"
- `/student`: "ทำได้ตอนนี้", "รอผู้อื่น", "เสร็จแล้ว/ดูย้อนหลัง", "ขั้นตอนที่ล็อก"
- `/student/schedule`: "ต้องทำตอนนี้", "รอกรรมการ", "เสร็จแล้ว", "ล็อก/ยังไม่พร้อม"
- `/student/report`: "ยังส่งเล่มไม่ได้", "ยังไม่ถึงขั้นตอนส่งเล่มรายงาน"
- `/teacher`: "งานที่ต้องดำเนินการ"
- `/teacher/reports`: wording around latest report/revision is understandable.
- `/admin/rounds`: "พร้อมเข้าสู่รอบนี้", "พร้อมแต่ยังไม่ครบ", "ยังไม่พร้อมรอบนี้", "ข้อยกเว้น/เปิดส่งย้อนหลัง"
- `/admin/closeout`: "ต้องกดยืนยัน", "รอคะแนนที่ปรึกษา", "รอรายงาน/แก้ไข", "เสร็จสมบูรณ์"

## Ambiguous / Mixed Text

| Route | Visible text | Problem | Suggested replacement |
|---|---|---|---|
| Student/Teacher/Admin dashboards | `now` | English marker with low meaning. | Use "ตอนนี้", "ถัดไป", or icon-only. |
| `/admin/proposals` | "คะแนนยังไม่ครบ" | Useful, but needs clearer policy context because missing proposal scores are excluded from average. | "คะแนนอาจารย์ยังไม่ครบ (ไม่นับคะแนนที่ยังไม่ส่ง)" |
| `/admin/evidence` | "ประวัติ 33 / 7" | Meaning is unclear without context. | "เหตุการณ์ 33 รายการ / ยังขาด 7 หลักฐาน" or a clearer legend. |

## Programmer / Internal Wording

| Route | Text | Problem | Priority |
|---|---|---|---|
| `/student`, `/admin`, `/admin/evidence` | `Wave 2 Progress 2 score submitted after confirmed schedule and evidence review.` | Internal QA sentence exposed to users. | Should fix before Wave 2 real-user observation. |
| `/student/proposal` | `Abstract for MULTI-PILOT-R2 Wave 2 Project...` | Test-data English reads as unfinished content. | Should fix before Wave 2 if students observe. |
| `/admin/evidence` | `Report approval evidence` | English audit label in Thai admin page. | Should fix before Wave 2. |
| `/admin/evidence` | `late round submission opened` | Raw audit event key. | Should fix before Wave 2. |
| `/admin/proposals` | `decided_by`, `decided_at` | Raw field names in operational UI. | Should fix before Wave 2. |
| QA login | English descriptions for pilot setup | QA-only, acceptable, but do not screenshot secrets. | Can defer. |

## Raw Enum / Status Labels

| Route | Text | Problem | Suggested display |
|---|---|---|---|
| `/student/proposal`, `/admin/proposals` | `PASS` | Raw enum-like status. | "ผ่าน" |
| `/admin/proposals` | `PASS_WITH_REVISION` | Raw enum-like status. | "ผ่านแบบให้แก้ไข" |
| `/admin/proposals` | `NOT_PASS` / `FAIL` | Raw enum-like status. | "ไม่ผ่าน" |
| Student dashboard | `ADVISOR`, `MEMBER`, `HEAD` | English role badges. | "ที่ปรึกษา", "กรรมการ", "ประธาน" if shown to real users. |

## Error / Success Messages

No blocking user-facing error/success message was found in the audited pages. QA login warnings are clear but QA-only.

## Text Cleanup Priority

Before Wave 2, prioritize:

1. Student-visible evidence/comment text.
2. Admin evidence/export labels.
3. Raw enum/audit field names in admin proposal and evidence pages.
4. English `now` marker and English role badges.
