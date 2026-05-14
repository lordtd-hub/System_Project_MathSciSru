import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractLineWebhookSources, verifyLineSignature } from "./lineWebhook";

function sign(rawBody: string, secret: string) {
  return createHmac("sha256", secret).update(rawBody).digest("base64");
}

describe("LINE webhook helpers", () => {
  it("verifies the LINE signature against the raw request body", () => {
    const rawBody = JSON.stringify({ events: [] });
    const secret = "line-secret";

    expect(verifyLineSignature(rawBody, sign(rawBody, secret), secret)).toBe(true);
    expect(verifyLineSignature(rawBody, "bad-signature", secret)).toBe(false);
    expect(verifyLineSignature(rawBody, null, secret)).toBe(false);
  });

  it("extracts groupId without reading or logging full message text", () => {
    expect(extractLineWebhookSources({
      events: [
        {
          type: "message",
          source: {
            type: "group",
            groupId: "C123",
            userId: "U123"
          },
          message: {
            type: "text",
            text: "ทดสอบระบบ"
          }
        }
      ]
    })).toEqual([
      {
        eventType: "message",
        sourceType: "group",
        groupId: "C123",
        userId: "U123",
        messageType: "text"
      }
    ]);
  });
});
