import { createAdminClient } from "@/lib/supabase/admin";
import { estadoDePlantilla } from "@/lib/whatsapp/graph";

/**
 * Pone al dia el estado de las plantillas que siguen en revision en Meta.
 * Antes solo cambiaba al pulsar "Sincronizar": una plantilla aprobada seguia
 * figurando como pendiente (y el CRM se negaba a enviarla) hasta que alguien lo
 * hacia a mano. Solo revisa las pendientes, de una en una por nombre.
 */
export async function sincronizarEstadoDePlantillas(): Promise<void> {
  const supabase = createAdminClient();
  const { data: pendientes } = await supabase
    .from("templates")
    .select("id, workspace_id, waba_id, meta_template_name, language, status, category")
    .in("status", ["PENDING", "IN_APPEAL"])
    .not("waba_id", "is", null)
    .limit(100);

  const tokens = new Map<string, string | null>();
  let cambiadas = 0;

  for (const t of pendientes ?? []) {
    const clave = `${t.workspace_id}:${t.waba_id}`;
    if (!tokens.has(clave)) {
      const { data: cuenta } = await supabase
        .from("whatsapp_accounts")
        .select("access_token")
        .eq("workspace_id", t.workspace_id)
        .eq("waba_id", t.waba_id)
        .neq("status", "frozen")
        .limit(1)
        .maybeSingle();
      tokens.set(clave, (cuenta?.access_token as string | undefined) ?? null);
    }
    const token = tokens.get(clave);
    if (!token) continue;

    try {
      const enMeta = (await estadoDePlantilla(t.waba_id as string, token, t.meta_template_name as string)).find(
        (m) => m.language === t.language
      );
      if (!enMeta) continue;
      if (enMeta.status !== t.status || enMeta.category !== t.category) {
        await supabase
          .from("templates")
          .update({ status: enMeta.status, category: enMeta.category, synced_at: new Date().toISOString() })
          .eq("id", t.id);
        cambiadas += 1;
      }
    } catch (err) {
      console.warn("plantillas: no se pudo revisar el estado en Meta:", err instanceof Error ? err.message : err);
    }
  }
  if (cambiadas > 0) console.log(`plantillas: ${cambiadas} plantilla(s) con estado nuevo en Meta`);
}
