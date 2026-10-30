import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUsers } from "@/lib/push/send";

/** Cuanto antes de la hora de la cita llega el aviso. */
export const MINUTOS_ANTES_DEL_AVISO = 10;
/** Una cita que ya empezo hace mas de esto no se avisa (el servidor estuvo caido, por ejemplo). */
const MINUTOS_DE_GRACIA = 15;

const horaCorta = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" });

/** Titulo y texto del aviso (lo mismo en el celular y en la campana). */
export function textoDelAviso(d: { contacto: string; titulo: string; inicioIso: string; conMeet: boolean }) {
  return {
    titulo: `📅 Tienes una reunión con ${d.contacto} a las ${horaCorta(d.inicioIso)}`,
    cuerpo: d.conMeet ? `${d.titulo} · Entra a la reunión de Meet desde aquí.` : d.titulo,
  };
}

/**
 * Citas que empiezan en los proximos minutos → aviso a quien las programo: push
 * al celular y notificacion en la campana (solo para esa persona) con el boton
 * "Ir a la reunión" al link de Meet. Una sola vez por cita (aviso_enviado_el,
 * migracion 0164). Corre cada minuto en el proceso de fondo.
 */
export async function avisarCitasProximas() {
  const supabase = createAdminClient();
  const ahora = Date.now();
  const hasta = new Date(ahora + MINUTOS_ANTES_DEL_AVISO * 60_000).toISOString();
  const desde = new Date(ahora - MINUTOS_DE_GRACIA * 60_000).toISOString();

  const { data: citas } = await supabase
    .from("agenda_eventos")
    .select("id, workspace_id, titulo, inicio, fin, meet_url, conversation_id, created_by, contacts(name, wa_id)")
    .is("aviso_enviado_el", null)
    .eq("estado", "confirmado")
    .gte("inicio", desde)
    .lte("inicio", hasta)
    .order("inicio")
    .limit(100);

  for (const c of citas ?? []) {
    // Se marca primero: si algo falla despues, no se repite el aviso cada minuto.
    const { data: marcada } = await supabase
      .from("agenda_eventos")
      .update({ aviso_enviado_el: new Date().toISOString() })
      .eq("id", c.id)
      .is("aviso_enviado_el", null)
      .select("id")
      .maybeSingle();
    if (!marcada) continue;

    // A quien avisar: quien programo la cita; si no se sabe, a los duenos/administradores del espacio.
    let destinatarios: string[] = c.created_by ? [c.created_by as string] : [];
    if (!destinatarios.length) {
      const { data: admins } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", c.workspace_id)
        .in("role", ["owner", "admin"]);
      destinatarios = (admins ?? []).map((a) => a.user_id as string);
    }
    if (!destinatarios.length) continue;

    const contacto = c.contacts as unknown as { name: string | null; wa_id: string } | null;
    const quien = contacto?.name?.trim() || contacto?.wa_id || "tu cliente";
    const meet = (c.meet_url as string | null) ?? null;
    const { titulo, cuerpo } = textoDelAviso({ contacto: quien, titulo: c.titulo as string, inicioIso: c.inicio as string, conMeet: !!meet });
    const irA = meet ?? (c.conversation_id ? `/dashboard/inbox/${c.conversation_id}` : "/dashboard/agenda");

    // Campana: un aviso por persona (target_user_id, 0160), visible hasta que termine la cita.
    const finAviso = new Date(new Date((c.fin as string) ?? (c.inicio as string)).getTime() + 60 * 60_000).toISOString();
    const { error } = await supabase.from("notifications").insert(
      destinatarios.map((userId) => ({
        title: titulo,
        body: cuerpo,
        scope: "workspace",
        target_workspace_id: c.workspace_id,
        target_user_id: userId,
        cta_label: meet ? "Ir a la reunión" : "Ir al chat",
        cta_url: irA,
        ends_at: finAviso,
      }))
    );
    if (error) console.error("aviso de cita: no se pudo crear la notificacion:", error.message);

    await sendPushToUsers(supabase, destinatarios, {
      title: titulo,
      body: cuerpo,
      url: irA,
      tag: `cita-${c.id}`,
    }).catch(() => 0);
  }
}
