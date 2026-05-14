# LINE Notification Setup Notes

Status: webhook setup prepared. LINE message sending has not been implemented yet.

## LINE Official Account

- Account name: `MathSCISRU`
- Business category: `องค์กร หรือสถาบัน · องค์กร หรือสถาบัน(อื่นๆ)`
- Basic ID: `@428chrry`

## Intended Use

Use this LINE Official Account as the system notification sender for the Mathematical Project Course system.

Recommended notification scope:

- Send short reminders to the teacher LINE group.
- Keep all approval, scoring, and sensitive details inside the web app.
- Do not send Proposal submission email/LINE spam for normal Proposal rounds.
- Candidate LINE events:
  - advisor request submitted;
  - exam schedule proposed or resubmitted;
  - high-value admin/teacher reminders only if approved later.

## Values Still Needed Before Implementation

Do not commit these values to the repository.

- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `LINE_TEACHER_GROUP_ID`

## Webhook Endpoint

The setup webhook endpoint is:

- `/api/line/webhook`

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

## How To Get `LINE_TEACHER_GROUP_ID`

1. Enable Messaging API for the LINE Official Account.
2. Configure webhook URL after the app endpoint exists, for example:
   - `https://<production-domain>/api/line/webhook`
3. Invite the LINE Official Account into the teacher LINE group.
4. Ask someone in the group to send a test message.
5. Read the webhook event `source.groupId`.
6. Store that value as `LINE_TEACHER_GROUP_ID` in Vercel environment variables.

## Current Vercel Environment Values To Set

Set these after the endpoint is deployed to an environment LINE can reach:

```text
LINE_NOTIFICATIONS_ENABLED=0
LINE_CHANNEL_SECRET=<from LINE Developers>
LINE_CHANNEL_ACCESS_TOKEN=<from LINE Developers, keep secret>
LINE_TEACHER_GROUP_ID=<from webhook event, after invite/test>
```

Keep `LINE_NOTIFICATIONS_ENABLED=0` until message sending is implemented and intentionally enabled.

## Safety Rules

- LINE notification must be feature-flagged.
- Default state must be off.
- Do not include scores, detailed feedback, or sensitive student comments in LINE group messages.
- LINE messages should contain only a short event summary and a link back to the web app.
- Failed LINE sends must not block the original workflow action.
