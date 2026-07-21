export async function register() {
  // Only run in the actual Node.js server process, not the edge runtime or
  // during `next build`.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { processDueAutomationRuns } = await import("@/lib/automations/scheduler");
  const { expireTrials } = await import("@/lib/billing/scheduler");

  setInterval(() => {
    processDueAutomationRuns().catch((err) => {
      console.error("automation scheduler tick failed:", err);
    });
  }, 20_000);

  setInterval(() => {
    expireTrials().catch((err) => {
      console.error("trial expiry scheduler tick failed:", err);
    });
  }, 5 * 60_000);
}
