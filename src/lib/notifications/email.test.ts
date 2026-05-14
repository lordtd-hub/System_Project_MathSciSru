import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAppUrl, emailNotificationsEnabled, sendEmailNotification } from "./email";
import {
  buildAdvisorRequestEmailTemplate,
  buildExamScheduleProposedEmailTemplate,
  buildProposalSubmittedEmailTemplate,
  formatAssessmentRoundLabel
} from "./templates";

const baseEnv = { ...process.env };

afterEach(() => {
  process.env = { ...baseEnv };
  vi.unstubAllGlobals();
});

describe("email notification transport", () => {
  it("stays disabled unless the explicit email flag is enabled", () => {
    expect(emailNotificationsEnabled({ ...process.env, EMAIL_NOTIFICATIONS_ENABLED: "0" })).toBe(false);
    expect(emailNotificationsEnabled({ ...process.env, EMAIL_NOTIFICATIONS_ENABLED: "1" })).toBe(true);
  });

  it("builds app links from configured public app URLs", () => {
    expect(buildAppUrl("/teacher/schedules", { ...process.env, APP_BASE_URL: "https://example.test/" })).toBe("https://example.test/teacher/schedules");
    expect(buildAppUrl("/teacher/proposals", { ...process.env, VERCEL_URL: "preview.vercel.app" })).toBe("https://preview.vercel.app/teacher/proposals");
  });

  it("builds Thai workflow templates from one template layer", () => {
    expect(buildAdvisorRequestEmailTemplate({
      projectLabel: "65123456 สมชาย ใจดี - หัวข้อทดสอบ",
      recipientName: "ผศ.ดร.สิทธิโชค ทรงสอาด"
    })).toMatchObject({
      subject: "มีนักศึกษาขอเลือกท่านเป็นอาจารย์ที่ปรึกษา",
      actionLabel: "เปิดคำขอที่ปรึกษา"
    });

    expect(buildProposalSubmittedEmailTemplate({
      projectLabel: "65123456 สมชาย ใจดี - หัวข้อทดสอบ"
    }).body).toContain("หลังการนำเสนอและซักถามในรอบ Proposal");

    expect(buildExamScheduleProposedEmailTemplate({
      projectLabel: "65123456 สมชาย ใจดี - หัวข้อทดสอบ",
      roundType: "PROGRESS_1",
      scheduleRange: "14 พ.ค. 2569 09:00 - 10:00 น.",
      room: "MS-501"
    }).body).toContain("ห้อง: MS-501");

    expect(formatAssessmentRoundLabel("FINAL_PRESENTATION")).toBe("สอบนำเสนอขั้นสุดท้าย");
  });

  it("skips sending without a provider key and never calls fetch", async () => {
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
});
