// Normalizes a phone number as typed by a user (with or without country code,
// "+", spaces, dashes) into the digits-only format WhatsApp's Cloud API
// expects as wa_id. Assumes Colombia as the default market: a 10-digit
// number starting with 3 (the local mobile prefix) gets the country code 57
// prepended, since that's the shape clients paste in most often.
export function normalizeWaId(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;

  if (digits.length === 10 && digits.startsWith("3")) {
    return `57${digits}`;
  }

  if (digits.length >= 8 && digits.length <= 15) {
    return digits;
  }

  return null;
}
