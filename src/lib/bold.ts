import crypto from "node:crypto";

export function generateBoldIntegritySignature(
  orderId: string,
  amountCents: number,
  currency: string
): string {
  const secretKey = process.env.BOLD_SECRET_KEY!;
  const raw = `${orderId}${amountCents}${currency}${secretKey}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function getBoldTransactionStatus(orderId: string): Promise<string | null> {
  const res = await fetch(`https://api.online.payments.bold.co/v1/payment/${orderId}`, {
    headers: { Authorization: `x-api-key ${process.env.NEXT_PUBLIC_BOLD_IDENTITY_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.status ?? null;
}

export function verifyBoldWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  if (!signatureHeader) return false;
  const secretKey = process.env.BOLD_SECRET_KEY!;
  const encodedBody = Buffer.from(rawBody).toString("base64");
  const expected = crypto
    .createHmac("sha256", secretKey)
    .update(encodedBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}
