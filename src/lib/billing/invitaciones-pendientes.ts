import type { SupabaseClient } from "@supabase/supabase-js";
import { origenPublico } from "@/lib/http/origen-publico";
import type { InvitacionPendiente } from "@/components/inbox/espacio-del-cliente";

/** Enlaces de registro con pago aún sin usar de un contacto (solo devuelve filas al administrador, por RLS). */
export async function invitacionesPendientesDeContacto(
  supabase: SupabaseClient,
  contactId: string
): Promise<InvitacionPendiente[]> {
  const { data } = await supabase
    .from("invitaciones_registro")
    .select("id, token, amount_cents, currency, created_at, tipo, dias_demo, plans(name)")
    .eq("contact_id", contactId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (!data || data.length === 0) return [];
  const origen = await origenPublico();
  return data.map((i) => ({
    id: i.id,
    enlace: `${origen}/signup?i=${i.token}`,
    plan_name: (i.plans as unknown as { name: string } | null)?.name ?? null,
    amount_cents: Number(i.amount_cents),
    currency: i.currency,
    created_at: i.created_at,
    tipo: (i.tipo as "pago" | "demo") ?? "pago",
    dias_demo: (i.dias_demo as number | null) ?? null,
  }));
}
