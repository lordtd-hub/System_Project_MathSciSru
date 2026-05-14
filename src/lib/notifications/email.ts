export type EmailNotificationPayload = {
  to: string;
  subject: string;
  title: string;
  body: string;
  actionUrl: string;
  actionLabel: string;
  previewText?: string;
};

export type EmailNotificationResult =
  | { status: "sent"; id?: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function emailNotificationsEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.EMAIL_NOTIFICATIONS_ENABLED === "1";
}

export function getAppBaseUrl(env: NodeJS.ProcessEnv = process.env) {
  const explicit =
    env.APP_BASE_URL?.trim() ||
    env.NEXT_PUBLIC_APP_URL?.trim() ||
    env.AUTH_URL?.trim() ||
    env.NEXTAUTH_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercelUrl = env.VERCEL_URL?.trim();
  return vercelUrl ? `https://${vercelUrl.replace(/\/+$/, "")}` : undefined;
}

export function buildAppUrl(path: string, env: NodeJS.ProcessEnv = process.env) {
  const baseUrl = getAppBaseUrl(env);
  if (!baseUrl) return undefined;
  return new URL(path, `${baseUrl}/`).toString();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderNotificationHtml(payload: EmailNotificationPayload) {
  const title = escapeHtml(payload.title);
  const body = escapeHtml(payload.body).replaceAll("\n", "<br />");
  const actionUrl = escapeHtml(payload.actionUrl);
  const actionLabel = escapeHtml(payload.actionLabel);

  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Tahoma,'Noto Sans Thai',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(payload.previewText ?? payload.title)}</div>
  <main style="max-width:640px;margin:0 auto;padding:24px;">
    <section style="border:1px solid #e2e8f0;border-left:6px solid #9f1239;border-radius:12px;background:#ffffff;padding:24px;">
      <p style="margin:0 0 8px;color:#9f1239;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">ระบบประเมินการนำเสนอโครงงาน</p>
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.35;">${title}</h1>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.7;">${body}</p>
      <a href="${actionUrl}" style="display:inline-block;border-radius:8px;background:#9f1239;color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:700;">${actionLabel}</a>
      <p style="margin:20px 0 0;color:#64748b;font-size:13px;line-height:1.6;">หากปุ่มเปิดไม่ได้ ให้เข้าสู่ระบบแล้วเปิดลิงก์นี้:<br /><span style="word-break:break-all;">${actionUrl}</span></p>
    </section>
  </main>
</body>
</html>`;
}

export async function sendEmailNotification(payload: EmailNotificationPayload): Promise<EmailNotificationResult> {
  if (!emailNotificationsEnabled()) {
    return { status: "skipped", reason: "EMAIL_NOTIFICATIONS_ENABLED is not 1" };
  }

  const apiKey = readEnv("RESEND_API_KEY");
  const from = readEnv("EMAIL_FROM") ?? "Project Presentation System <onboarding@resend.dev>";
  if (!apiKey) return { status: "skipped", reason: "RESEND_API_KEY is not configured" };
  if (!payload.to.includes("@")) return { status: "skipped", reason: "recipient email is invalid" };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        from,
        to: payload.to,
        subject: payload.subject,
        html: renderNotificationHtml(payload)
      })
    });

    const responseBody = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok) {
      return { status: "failed", reason: responseBody.message ?? `Resend API returned ${response.status}` };
    }
    return { status: "sent", id: responseBody.id };
  } catch (error) {
    return { status: "failed", reason: error instanceof Error ? error.message : "unknown email error" };
  }
}

