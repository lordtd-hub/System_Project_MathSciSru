import { createHmac, timingSafeEqual } from "node:crypto";

export type LineWebhookSource = {
  eventType: string;
  sourceType: string;
  groupId?: string;
  roomId?: string;
  userId?: string;
  messageType?: string;
};

type LineWebhookEvent = {
  type?: unknown;
  source?: {
    type?: unknown;
    groupId?: unknown;
    roomId?: unknown;
    userId?: unknown;
  };
  message?: {
    type?: unknown;
  };
};

type LineWebhookPayload = {
  events?: unknown;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export function verifyLineSignature(rawBody: string, signature: string | null | undefined, channelSecret: string) {
  if (!signature || !channelSecret) return false;

  const expected = createHmac("sha256", channelSecret).update(rawBody).digest("base64");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer);
}

export function extractLineWebhookSources(payload: LineWebhookPayload): LineWebhookSource[] {
  const events = Array.isArray(payload.events) ? payload.events : [];

  return events.map((event): LineWebhookSource => {
    const lineEvent = event as LineWebhookEvent;
    return {
      eventType: asString(lineEvent.type) ?? "unknown",
      sourceType: asString(lineEvent.source?.type) ?? "unknown",
      groupId: asString(lineEvent.source?.groupId),
      roomId: asString(lineEvent.source?.roomId),
      userId: asString(lineEvent.source?.userId),
      messageType: asString(lineEvent.message?.type)
    };
  });
}
