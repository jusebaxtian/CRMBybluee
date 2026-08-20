export async function register() {
  // Only run in the actual Node.js server process, not the edge runtime or
  // during `next build`.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { processDueAutomationRuns } = await import("@/lib/automations/scheduler");
  const { expireTrials, expireLapsedActiveSubscriptions } = await import("@/lib/billing/scheduler");
  const { processAiFollowups } = await import("@/lib/ai/followups");
  const { cleanupOldNotifications } = await import("@/lib/notifications/scheduler");
  const { processDueCampaigns } = await import("@/lib/campaigns/scheduler");
  const { deleteStaleUnactivatedWorkspaces } = await import("@/lib/billing/cleanup");

  setInterval(() => {
    processDueAutomationRuns().catch((err) => {
      console.error("automation scheduler tick failed:", err);
    });
  }, 20_000);

  setInterval(() => {
    processAiFollowups().catch((err) => {
      console.error("AI followup scheduler tick failed:", err);
    });
  }, 60_000);

  setInterval(() => {
    expireTrials().catch((err) => {
      console.error("trial expiry scheduler tick failed:", err);
    });
  }, 5 * 60_000);

  setInterval(() => {
    expireLapsedActiveSubscriptions().catch((err) => {
      console.error("active subscription expiry scheduler tick failed:", err);
    });
  }, 5 * 60_000);

  setInterval(() => {
    cleanupOldNotifications().catch((err) => {
      console.error("notifications cleanup scheduler tick failed:", err);
    });
  }, 60 * 60_000);

  setInterval(() => {
    processDueCampaigns().catch((err) => {
      console.error("campaign scheduler tick failed:", err);
    });
  }, 30_000);

  setInterval(() => {
    deleteStaleUnactivatedWorkspaces().catch((err) => {
      console.error("stale workspace cleanup tick failed:", err);
    });
  }, 60 * 60_000);
}
