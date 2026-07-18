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
