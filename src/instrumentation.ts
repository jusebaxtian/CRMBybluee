export async function register() {
  // Only run in the actual Node.js server process, not the edge runtime or
  // during `next build`.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { processDueAutomationRuns } = await import("@/lib/automations/scheduler");

  setInterval(() => {
    processDueAutomationRuns().catch((err) => {
      console.error("automation scheduler tick failed:", err);
    });
  }, 20_000);
}
