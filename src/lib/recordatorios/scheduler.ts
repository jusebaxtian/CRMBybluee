import { createAdminClient } from "@/lib/supabase/admin";

const DIAS_VISIBLE_AVISO = 3;
/** Los recordatorios cumplidos quedan como historial en la Agenda este tiempo. */
export const DIAS_HISTORIAL_RECORDATORIOS = 60;

/**
 * Recordatorios vencidos → aviso en la campana del espacio y se marcan
 * como avisados (quedan 60 dias como historial en la Agenda, migracion
 * 0112). Corre cada minuto en el proceso de fondo.
 */
export async function processDueReminders() {
  const supabase = createAdminClient();
  const ahora = new Date();

  const { data: vencidos } = await supabase
    .from("recordatorios")
    .select("id, workspace_id, conversation_id, texto, contacts(name, wa_id)")
    .is("avisado_en", null)
    .lte("recordar_en", ahora.toISOString())
    .order("recordar_en")
    .limit(100);

  const endsAt = new Date(ahora.getTime() + DIAS_VISIBLE_AVISO * 24 * 60 * 60 * 1000).toISOString();
  for (const r of vencidos ?? []) {
    const contacto = r.contacts as unknown as { name: string | null; wa_id: string } | null;
    const quien = contacto?.name?.trim() || contacto?.wa_id || "contacto";
    const { error } = await supabase.from("notifications").insert({
      title: `Recordatorio del contacto ${quien}`,
      body: r.texto,
      scope: "workspace",
      target_workspace_id: r.workspace_id,
      cta_label: "Ir al chat",
      cta_url: `/dashboard/inbox/${r.conversation_id}`,
      ends_at: endsAt,
    });
    if (error) {
      console.error("recordatorio: no se pudo crear el aviso:", error.message);
      continue;
    }
    await supabase.from("recordatorios").update({ avisado_en: ahora.toISOString() }).eq("id", r.id);
  }

  // Historial: pasados 60 dias de la fecha del recordatorio, se borra.
  const corte = new Date(ahora.getTime() - DIAS_HISTORIAL_RECORDATORIOS * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("recordatorios").delete().lt("recordar_en", corte);
}
