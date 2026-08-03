// Once WhatsApp's username/BSUID rollout is live (see migration
// 0025_bsuid_support), "wa_id" won't always be a phone number — a
// username-only contact's wa_id can be their BSUID instead (format like
// "CO.ABC123XYZ"). Phone numbers are digits only (with an optional leading
// "+"), so a simple digit check is enough to tell them apart.
export function isPhoneNumber(waId: string): boolean {
  return /^\+?\d{6,15}$/.test(waId);
}
