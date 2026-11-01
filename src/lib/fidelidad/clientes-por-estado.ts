import type { SupabaseClient } from "@supabase/supabase-js";

export type ClienteResumen = {
  workspaceId: string;
  nombre: string;
  plan: string | null;
  esDemo: boolean;
  /** Fin del plan o de la prueba (ISO), o null si no se sabe. */
  vence: string | null;
  /** Dias hasta el vencimiento (negativo = ya vencio). */
  dias: number | null;
  /** Chat con el cliente en el espacio del administrador, si lo hay. */
  conversationId: string | null;
};

export type ClientesPorEstado = { activos: ClienteResumen[]; porVencer: ClienteResumen[]; vencidos: ClienteResumen[] };

const DIA_MS = 86_400_000;
/** "Por vencer": le quedan estos dias o menos. */
export const DIAS_POR_VENCER = 7;

/**
 * Clasifica a un cliente. Vencido: el cobro ya lo marco (past_due / canceled)
 * o su fecha ya paso. Por vencer: activo y le quedan 7 dias o menos. El resto
 * de activos, activos.
 */
export function clasificar(status: string, vence: string | null, ahora: Date): "activos" | "porVencer" | "vencidos" {
  if (status === "past_due" || status === "canceled" || status === "suspended") return "vencidos";
  if (!vence) return "activos";
  const resta = new Date(vence).getTime() - ahora.getTime();
  if (resta < 0) return "vencidos";
  if (resta <= DIAS_POR_VENCER * DIA_MS) return "porVencer";
  return "activos";
}

/**
 * Todos los clientes (espacios) menos el del administrador, en tres grupos.
 * `supabase` es la sesion del administrador (la funcion que liga cada espacio
 * con su contacto solo le responde a el); `admin` es el cliente de servicio.
 */
export async function cargarClientesPorEstado(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  espacioDelAdmin: string | null,
  ahora: Date = new Date()
): Promise<ClientesPorEstado> {
  const [{ data: espacios }, { data: subs }, { data: planes }, { data: enlaces }] = await Promise.all([
    admin.from("workspaces").select("id, name, status, plan_id, trial_ends_at"),
    admin.from("subscriptions").select("workspace_id, current_period_end"),
    admin.from("plans").select("id, name, is_demo"),
    supabase.rpc("admin_clientes_de_espacios"),
  ]);

  const finDe = new Map<string, string>();
  for (const s of subs ?? []) {
    const f = s.current_period_end as string | null;
    if (f && (!finDe.has(s.workspace_id) || f > finDe.get(s.workspace_id)!)) finDe.set(s.workspace_id, f);
  }
  const planDe = new Map((planes ?? []).map((p) => [p.id as string, { nombre: p.name as string, demo: !!p.is_demo }]));

  // Chat de cada cliente en el espacio del administrador.
  const contactoDe = new Map(
    ((enlaces ?? []) as { workspace_id: string; contact_id: string }[]).map((e) => [e.workspace_id, e.contact_id])
  );
  const chatDe = new Map<string, string>();
  const contactos = [...new Set(contactoDe.values())];
  if (espacioDelAdmin && contactos.length) {
    for (let i = 0; i < contactos.length; i += 200) {
      const { data: convs } = await admin
        .from("conversations")
        .select("id, contact_id, last_message_at")
        .eq("workspace_id", espacioDelAdmin)
        .in("contact_id", contactos.slice(i, i + 200))
        .order("last_message_at", { ascending: false });
      for (const c of convs ?? []) if (!chatDe.has(c.contact_id as string)) chatDe.set(c.contact_id as string, c.id as string);
    }
  }

  const grupos: ClientesPorEstado = { activos: [], porVencer: [], vencidos: [] };
  for (const e of espacios ?? []) {
    if (e.id === espacioDelAdmin) continue;
    const vence = finDe.get(e.id) ?? (e.trial_ends_at as string | null) ?? null;
    const plan = e.plan_id ? planDe.get(e.plan_id as string) : undefined;
    const contacto = contactoDe.get(e.id);
    grupos[clasificar(e.status as string, vence, ahora)].push({
      workspaceId: e.id as string,
      nombre: (e.name as string) || "Sin nombre",
      plan: plan?.nombre ?? null,
      esDemo: plan?.demo ?? false,
      vence,
      dias: vence ? Math.ceil((new Date(vence).getTime() - ahora.getTime()) / DIA_MS) : null,
      conversationId: contacto ? (chatDe.get(contacto) ?? null) : null,
    });
  }

  // Por vencer: el que vence antes, primero. Vencidos: el mas reciente primero. Activos: por nombre.
  grupos.porVencer.sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0));
  grupos.vencidos.sort((a, b) => (b.dias ?? -9999) - (a.dias ?? -9999));
  grupos.activos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return grupos;
}
