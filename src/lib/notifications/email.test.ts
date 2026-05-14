import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAppUrl, emailNotificationsEnabled, sendEmailNotification } from "./email";
import { lineNotificationsEnabled, sendLineNotification } from "./line";
import {
  buildAdvisorRequestEmailTemplate,
  buildExamScheduleProposedEmailTemplate,
  formatAssessmentRoundLabel
} from "./templates";

const baseEnv = { ...process.env };

afterEach(() => {
  process.env = { ...baseEnv };
  vi.unstubAllGlobals();
});

describe("notification transports", () => {
  it("keeps email and LINE disabled unless explicit flags are enabled", () => {
    expect(emailNotificationsEnabled({ ...process.env, EMAIL_NOTIFICATIONS_ENABLED: "0" })).toBe(false);
    expect(emailNotificationsEnabled({ ...process.env, EMAIL_NOTIFICATIONS_ENABLED: "1" })).toBe(true);
    expect(lineNotificationsEnabled({ ...process.env, LINE_NOTIFICATIONS_ENABLED: "0" })).toBe(false);
    expect(lineNotificationsEnabled({ ...process.env, LINE_NOTIFICATIONS_ENABLED: "1" })).toBe(true);
  });

  it("builds app links from configured public app URLs", () => {
    expect(buildAppUrl("/teacher/schedules", { ...process.env, APP_BASE_URL: "https://example.test/" })).toBe("https://example.test/teacher/schedules");
    expect(buildAppUrl("/teacher/proposals", { ...process.env, VERCEL_URL: "preview.vercel.app" })).toBe("https://preview.vercel.app/teacher/proposals");
  });

  it("builds Thai workflow templates from one template layer", () => {
    expect(buildAdvisorRequestEmailTemplate({
      projectLabel: "65123456 สมชาย ใจดี - หัวข้อทดสอบ",
      advisorName: "ผศ.ดร.สิทธิโชค ทรงสอาด",
      recipientName: "ผศ.ดร.สิทธิโชค ทรงสอาด"
    })).toMatchObject({
      subject: "มีนักศึกษาขอเลือกท่านเป็นอาจารย์ที่ปรึกษา",
      actionLabel: "เปิดคำขอที่ปรึกษา",
      body: expect.stringContaining("อาจารย์ที่ถูกขอเป็นที่ปรึกษา: ผศ.ดร.สิทธิโชค ทรงสอาด")
    });

    expect(buildExamScheduleProposedEmailTemplate({
      projectLabel: "65123456 สมชาย ใจดี - หัวข้อทดสอบ",
      roundType: "PROGRESS_1",
      scheduleRange: "14 พ.ค. 2569 09:00 - 10:00 น.",
      room: "MS-501"
    }).body).toContain("ห้อง: MS-501");

    expect(formatAssessmentRoundLabel("FINAL_PRESENTATION")).toBe("สอบนำเสนอขั้นสุดท้าย");
  });

  it("skips email sending without a provider key and never calls fetch", async () => {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = "1";
    delete process.env.RESEND_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendEmailNotification({
      to: "teacher@sru.ac.th",
      subject: "แจ้งเตือน",
      title: "แจ้งเตือน",
      body: "มีงานใหม่",
      actionUrl: "https://example.test/teacher",
      actionLabel: "เปิดระบบ"
    })).resolves.toMatchObject({ status: "skipped" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts UTF-8 HTML to Resend when configured", async () => {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = "1";
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "ระบบประเมินการนำเสนอโครงงาน <notify@example.test>";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_123" })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendEmailNotification({
      to: "teacher@sru.ac.th",
      subject: "มีคำขอนัดวันสอบ",
      title: "มีคำขอนัดวันสอบ",
      body: "นักศึกษาเสนอวันสอบแล้ว",
      actionUrl: "https://example.test/teacher/schedules",
      actionLabel: "เปิดตารางสอบ"
    })).resolves.toMatchObject({ status: "sent", id: "email_123" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "Content-Type": "application/json; charset=utf-8"
      })
    }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.html).toContain('<meta charset="utf-8" />');
    expect(body.html).toContain("ระบบประเมินการนำเสนอโครงงาน");
    expect(body.html).toContain("นักศึกษาเสนอวันสอบแล้ว");
  });

  it("pushes a short UTF-8 LINE message to the configured teacher group", async () => {
    process.env.LINE_NOTIFICATIONS_ENABLED = "1";
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "line_token";
    process.env.LINE_TEACHER_GROUP_ID = "C-test-group";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({})
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendLineNotification({
      title: "มีคำขอนัดวันสอบ",
      body: "65123456 สมชาย ใจดี\nรอบสอบ: สอบความก้าวหน้าครั้งที่ 1",
      actionUrl: "https://example.test/teacher/schedules",
      actionLabel: "เปิดตารางสอบ"
    })).resolves.toMatchObject({ status: "sent" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.line.me/v2/bot/message/push", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer line_token",
        "Content-Type": "application/json; charset=utf-8"
      })
    }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.to).toBe("C-test-group");
    expect(body.messages[0].text).toContain("ระบบประเมินการนำเสนอโครงงาน");
    expect(body.messages[0].text).toContain("เปิดตารางสอบ");
  });
});
