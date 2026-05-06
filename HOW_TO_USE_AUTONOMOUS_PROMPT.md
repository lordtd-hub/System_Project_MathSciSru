# วิธีใช้ Autonomous Codex Prompt

ไฟล์หลัก:

- `AUTONOMOUS_CODEX_PROMPT.md`
- `prompts/00_autonomous_mvp1.md`

## วิธีใช้

1. แตกไฟล์ zip ชุดเดิม `codex_project_assessment_pack.zip` ลงใน repo
2. copy `AUTONOMOUS_CODEX_PROMPT.md` จาก pack นี้ไปไว้ที่ root repo เดียวกัน
3. เปิด Codex ใน repo
4. ส่ง prompt นี้:

```text
Read AUTONOMOUS_CODEX_PROMPT.md and work autonomously through MVP 1. Continue task by task, run validation commands yourself, update IMPLEMENTATION_PROGRESS.md, and stop only when blocked or MVP 1 is complete.
```

## ถ้าอยากให้ Codex เริ่มต่อจาก task ที่ค้าง

```text
Read IMPLEMENTATION_PROGRESS.md and continue from the next unchecked task. Follow AUTONOMOUS_CODEX_PROMPT.md. Run validation commands yourself and update progress after each completed task.
```

## ถ้า Codex ทำหลุด scope

ส่งข้อความนี้:

```text
Stop expanding scope. Re-read PROJECT_SPEC.md and AUTONOMOUS_CODEX_PROMPT.md. Continue MVP 1 only. Do not implement Progress, Final, external committee, or full AUN-QA export yet.
```

## ถ้า build/test fail

```text
Continue debugging. Run the failing command again, identify the root cause, fix it, and rerun lint, typecheck, tests, and build. Update IMPLEMENTATION_PROGRESS.md with the result.
```
