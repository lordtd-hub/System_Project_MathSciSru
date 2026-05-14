import { NextResponse } from "next/server";
import { extractLineWebhookSources, verifyLineSignature } from "@/lib/notifications/lineWebhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "line-webhook",
      note: "Use POST from LINE Messaging API with x-line-signature."
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function POST(request: Request) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET?.trim();
  if (!channelSecret) {
    return NextResponse.json({ ok: false, error: "line_channel_secret_missing" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");
  if (!verifyLineSignature(rawBody, signature, channelSecret)) {
    return NextResponse.json({ ok: false, error: "invalid_line_signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const sources = extractLineWebhookSources(payload as { events?: unknown });
  const groupSources = sources.filter((source) => source.sourceType === "group" && source.groupId);

  if (groupSources.length) {
    console.info("LINE webhook group source detected", JSON.stringify(groupSources));
  } else {
    console.info("LINE webhook received", JSON.stringify({
      eventCount: sources.length,
      sources
    }));
  }

  return NextResponse.json(
    {
      ok: true,
      eventCount: sources.length,
      groupIds: [...new Set(groupSources.map((source) => source.groupId).filter(Boolean))]
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
