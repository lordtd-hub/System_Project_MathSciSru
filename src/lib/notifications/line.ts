import type { EmailNotificationPayload } from "@/lib/notifications/email";
import { NOTIFICATION_BRAND_NAME } from "@/lib/notifications/templates";

export type LineNotificationPayload = Pick<EmailNotificationPayload, "title" | "body" | "actionUrl" | "actionLabel">;

export type LineNotificationResult =
  | { status: "sent" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

export const LINE_NOTIFICATION_TIMEOUT_MS = 5_000;

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function lineNotificationsEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.LINE_NOTIFICATIONS_ENABLED === "1";
}

export function buildLineMessageText(payload: LineNotificationPayload) {
  return [
    `[${NOTIFICATION_BRAND_NAME}]`,
    "",
    payload.title,
    "",
    payload.body,
    "",
    `${payload.actionLabel}:`,
    payload.actionUrl
  ].join("\n").slice(0, 5000);
}

export async function sendLineNotification(payload: LineNotificationPayload): Promise<LineNotificationResult> {
  if (!lineNotificationsEnabled()) {
    return { status: "skipped", reason: "LINE_NOTIFICATIONS_ENABLED is not 1" };
  }

  const channelAccessToken = readEnv("LINE_CHANNEL_ACCESS_TOKEN");
  const groupId = readEnv("LINE_TEACHER_GROUP_ID");
  if (!channelAccessToken) return { status: "skipped", reason: "LINE_CHANNEL_ACCESS_TOKEN is not configured" };
  if (!groupId) return { status: "skipped", reason: "LINE_TEACHER_GROUP_ID is not configured" };
  if (!payload.actionUrl) return { status: "skipped", reason: "actionUrl is not configured" };

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      signal: AbortSignal.timeout(LINE_NOTIFICATION_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${channelAccessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        to: groupId,
        messages: [
          {
            type: "text",
            text: buildLineMessageText(payload)
          }
        ]
      })
    });

    if (!response.ok) {
      const responseBody = await response.json().catch(() => ({})) as { message?: string };
      return { status: "failed", reason: responseBody.message ?? `LINE API returned ${response.status}` };
    }

    return { status: "sent" };
  } catch (error) {
    return { status: "failed", reason: error instanceof Error ? error.message : "unknown LINE error" };
  }
}
