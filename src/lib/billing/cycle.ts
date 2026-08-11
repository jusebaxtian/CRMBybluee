export type BillingCycle = "monthly" | "semiannual" | "yearly";

// Adds a billing cycle using calendar month arithmetic (not a fixed day
// count) so e.g. a yearly renewal from Jan 31 lands on the real next Jan 31
// instead of drifting by a few days every cycle.
export function addBillingCycle(from: Date, cycle: string): Date {
  const result = new Date(from);
  const months = cycle === "yearly" ? 12 : cycle === "semiannual" ? 6 : 1;
  result.setMonth(result.getMonth() + months);
  return result;
}
