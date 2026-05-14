# Priority Fix List

Date: 2026-05-14

This list is for UX stabilization only. It does not propose lifecycle, scoring, eligibility, auth, schema, or API changes.

## Must Fix

None found during this non-mutating UX audit.

No audited route showed shell-only rendering, digest/application error, unauthorized guard mismatch, or mobile horizontal overflow.

## Should Fix Before Wave 2 Expansion

### UX-001 Teacher dashboard duplicate surfaces

- Role: Teacher
- Routes: `/teacher`
- Device: desktop and mobile
- Issue: dashboard still has workload summary, action workspace, next card, agenda, account/role panel, and shortcut widgets competing for attention.
- Impact: teachers may scan the wrong area first when workload grows.
- Recommendation: keep current workload/action area first; minimize shortcut/account panels; avoid duplicated navigation widgets.

### UX-002 Admin proposal/schedule density

- Role: Admin
- Routes: `/admin/proposals`, `/admin/schedules`
- Device: desktop and mobile
- Issue: many badges, buttons, and project sections create visual noise at scale.
- Impact: Admin may miss the actual pending decision or exception case.
- Recommendation: introduce compact scan rows, group by operational bucket, and collapse completed/history sections.

### UX-003 Round exception/recovery visibility

- Role: Admin
- Routes: `/admin/round-exceptions`, `/admin/rounds`
- Device: desktop primarily
- Issue: late/reopen recovery is operationally important but still easy to miss if Admin only looks at round overview.
- Impact: Project03-style recovery may be understood by the system but not by the operator.
- Recommendation: make exception/recovery entrypoints and wording more explicit before higher-scale pilots.

### UX-004 Evidence/history technical language

- Role: Admin, Student, Teacher
- Routes: `/admin/evidence`, student feedback/report history, teacher review history
- Device: all
- Issue: raw event/status wording can still appear near user-facing evidence.
- Impact: users may read audit metadata as system errors or programmer language.
- Recommendation: map visible constants/event types to Thai user-facing labels.

## Can Defer To Redesign / Manual Phase

### UX-005 Full visual redesign

- Role: all
- Issue: the removed visual redesign attempt did not match the working product enough for day-to-day use.
- Recommendation: keep classic UI as active interface; redesign later after a cleaner mockup and component inventory.

### UX-006 Admin mobile complex operations

- Role: Admin
- Issue: mobile technically works, but complex actions like close round, reset round, and closeout are not ideal on phones.
- Recommendation: document Admin as desktop-first for complex operations; mobile can remain check/read-focused.

### UX-007 Deep form layout polish

- Role: Student, Teacher
- Issue: scoring/report/schedule forms can be visually improved, but they are functional.
- Recommendation: do not compact data-entry forms aggressively; improve them during a form-specific redesign.

## Nice To Have

### UX-008 Screenshot/manual readiness pass

- Run only after UX-001 to UX-004 are resolved or explicitly deferred.
- Ensure all screenshots use classic UI unless a future redesign is restarted and approved.

### UX-009 Tablet pass at 768px

- Current audit covered desktop and 390px mobile.
- Add tablet checks later if teachers commonly use tablets.

## Recommended Next Step

Perform a small classic UI cleanup before expanding Wave 2:

1. Teacher dashboard declutter.
2. Admin proposals/schedules compact grouping.
3. Round exception entrypoint clarity.
4. User-facing Thai label pass for evidence/history.

After those targeted fixes, continue Wave 2 toward a controlled 20-project check rather than restarting redesign.
