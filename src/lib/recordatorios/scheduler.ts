import { createAdminClient } from "@/lib/supabase/admin";

const DIAS_VISIBLE = 3;

/**
 * Recordatorios vencidos → aviso en la campana del espacio y se borran
 * (migracion 0110). Corre cada minuto en el proceso de fondo.
 */
export async function processDueReminders() {
  const supabase = createAdminClient();
  const ahora = new Date();

  const { data: vencidos } = await supabase
    .from("recordatorios")
    .select("id, workspace_id, conversation_id, texto, contacts(name, wa_id)")
    .lte("recordar_en", ahora.toISOString())
    .order("recordar_en")
    .limit(100);
  if (!vencidos || vencidos.length === 0) return;

  const endsAt = new Date(ahora.getTime() + DIAS_VISIBLE * 24 * 60 * 60 * 1000).toISOString();
  for (const r of vencidos) {
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
    await supabase.from("recordatorios").delete().eq("id", r.id);
  }
}
