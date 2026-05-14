# LINE Notification Setup Notes

Status: webhook receiver is deployed; LINE sender code is prepared for QA behind `LINE_NOTIFICATIONS_ENABLED`.

## LINE Official Account

- Account name: `MathSCISRU`
- Business category: `องค์กร หรือสถาบัน · องค์กร หรือสถาบัน(อื่นๆ)`
- Basic ID: `@428chrry`

## Current Intended Use

Use this LINE Official Account as a short teacher-group notification sender.

Send only:

- advisor request submitted;
- exam schedule proposed or resubmitted.

Do not send:

- normal Proposal submission messages;
- scores;
- detailed feedback;
- sensitive comments;
- noisy dashboard/internal status messages.

LINE should only say that work exists and link back to the web app. Approval, scoring, and detail reading stay inside the web app.

## Environment Values

Do not commit secret values to the repository.

Production currently uses the webhook receiver for setup. QA/Preview can be used for sender testing after these Preview env values are configured:

```text
LINE_NOTIFICATIONS_ENABLED=1
LINE_CHANNEL_ACCESS_TOKEN=<from LINE Developers>
LINE_CHANNEL_SECRET=<from LINE Developers>
LINE_TEACHER_GROUP_ID=<test groupId from webhook event>
```

Production should stay quiet until rollout approval:

```text
LINE_NOTIFICATIONS_ENABLED=0
```

## Webhook Endpoint

The setup webhook endpoint is:

```text
/api/line/webhook
```

Production URL:

```text
https://system-project-math-sci-sru.vercel.app/api/line/webhook
```

Behavior:

- `GET` returns a small health response.
- `POST` requires a valid LINE `x-line-signature`.
- Signature verification uses `LINE_CHANNEL_SECRET`.
- The route logs only setup metadata needed for configuration:
  - event type;
  - source type;
  - `groupId`, `roomId`, or `userId` if present;
  - message type.
- The route does not log full message text.

## Moving From Test Group To Real Teacher Group

1. Keep `LINE_NOTIFICATIONS_ENABLED=0` while switching groups.
2. Invite the LINE Official Account into the real teacher group.
3. Send one test message in that group.
4. Read Vercel logs for `LINE webhook group source detected`.
5. Copy the new `source.groupId`.
6. Replace `LINE_TEACHER_GROUP_ID` in the target Vercel environment.
7. Redeploy that environment.
8. Enable `LINE_NOTIFICATIONS_ENABLED=1` only after a controlled test is accepted.

The test group and real teacher group always have different `groupId` values.

## Safety Rules

- LINE notification must remain feature-flagged.
- Default state must be off.
- Failed LINE sends must not block the original workflow action.
- Keep source files UTF-8 and keep Thai message text readable, not mojibake.
