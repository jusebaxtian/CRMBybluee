import { createAdminClient } from "@/lib/supabase/admin";
import { executeCampaignSend } from "@/lib/campaigns/send";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

/**
 * Cuánto puede pasar sin latido antes de dar una campaña por muerta.
 *
 * El bucle late al empezar y cada 25 destinatarios, así que una campaña viva
 * nunca se acerca a este umbral ni con la API de Meta lenta. Diez minutos deja
 * margen de sobra y evita el escenario peligroso: reanudar una que sigue
 * trabajando, lo que pondría dos bucles sobre los mismos pendientes y enviaría
 * el mensaje dos veces al cliente.
 */
const STALLED_AFTER_MS = 10 * 60 * 1000;

/**
 * Arranca las campañas programadas cuya hora ya llegó, y reanuda las que
 * quedaron a medias.
 */
export async function processDueCampaigns() {
  const supabase = createAdminClient();
  await startDueCampaigns(supabase);
  await resumeStalledCampaigns(supabase);
}

/** Campañas en borrador cuya `scheduled_at` ya pasó. */
async function startDueCampaigns(supabase: SupabaseAdmin) {
  const { data: due } = await supabase
    .from("campaigns")
    .select("id, workspace_id")
    .eq("status", "draft")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", new Date().toISOString());

  for (const campaign of due ?? []) {
    // Se reclama primero (draft -> sending) para que un envío lento no lo
    // vuelva a tomar el siguiente tick — mismo patrón de reclamar-y-actuar
    // que el planificador de automatizaciones.
    const { data: claimed } = await supabase
      .from("campaigns")
      .update({
        status: "sending",
        started_at: new Date().toISOString(),
        last_progress_at: new Date().toISOString(),
      })
      .eq("id", campaign.id)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    await executeCampaignSend(supabase, campaign.workspace_id, campaign.id);
  }
}

/**
 * Reanuda campañas que quedaron atascadas en "sending".
 *
 * Antes esto no existía: el planificador solo miraba "draft", así que una
 * campaña interrumpida por un reinicio del proceso —despliegue, límite de
 * memoria, caída— se quedaba ahí para siempre y sus destinatarios pendientes
 * no salían nunca.
 *
 * Reanudar es seguro porque el bucle de envío solo toma destinatarios en
 * "pending": a quien ya recibió no se le reenvía.
 */
async function resumeStalledCampaigns(supabase: SupabaseAdmin) {
  const corte = new Date(Date.now() - STALLED_AFTER_MS).toISOString();

  const { data: stalled } = await supabase
    .from("campaigns")
    .select("id, workspace_id")
    .eq("status", "sending")
    .lt("last_progress_at", corte);

  for (const campaign of stalled ?? []) {
    // Reclamar el reinicio moviendo el latido antes de actuar. Si dos ticks
    // coincidieran, solo uno encuentra la fila todavía por debajo del corte.
    const { data: claimed } = await supabase
      .from("campaigns")
      .update({ last_progress_at: new Date().toISOString() })
      .eq("id", campaign.id)
      .eq("status", "sending")
      .lt("last_progress_at", corte)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    // Puede que no quede nada por enviar: el proceso murió justo después del
    // último destinatario, antes de marcar la campaña como completada. En ese
    // caso se cierra sin volver a entrar al bucle.
    const { count: pendientes } = await supabase
      .from("campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .eq("status", "pending");

    if (!pendientes) {
      const { count: fallidos } = await supabase
        .from("campaign_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .eq("status", "failed");
      const { count: total } = await supabase
        .from("campaign_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id);

      await supabase
        .from("campaigns")
        .update({ status: total && fallidos === total ? "failed" : "completed" })
        .eq("id", campaign.id);
      continue;
    }

    console.warn(
      `campaign ${campaign.id}: reanudando envío estancado, ${pendientes} destinatario(s) pendiente(s)`
    );
    await executeCampaignSend(supabase, campaign.workspace_id, campaign.id);
  }
}
