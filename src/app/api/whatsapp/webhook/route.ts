import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { ingestWhatsAppWebhook } from "@/lib/whatsapp/ingest";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/webhook-types";

// Meta's handshake to verify this endpoint before it will send events.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

function isValidSignature(rawBody: string, signatureHeader: string | null) {
  if (!signatureHeader) return false;
  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", process.env.META_APP_SECRET!)
      .update(rawBody)
      .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signatureHeader)
  );
}

// Meta requires a fast 200 response, so ingestion errors are logged, not thrown.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!isValidSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;

  try {
    await ingestWhatsAppWebhook(payload);
  } catch (err) {
    console.error("whatsapp webhook ingest error:", err);
  }

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}
