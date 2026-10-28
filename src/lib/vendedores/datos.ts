import type { SupabaseClient } from "@supabase/supabase-js";
import type { EstadoVenta } from "@/lib/vendedores/comision";

/** Una venta lista para pintar: con cliente, plan, vendedor y el estado de la licencia. */
export type VentaVista = {
  id: string;
  vendedorId: string;
  vendedorNombre: string;
  cliente: string;
  telefono: string | null;
  conversationId: string | null;
  plan: string;
  montoCents: number;
  comisionPct: number;
  comisionCents: number;
  estado: EstadoVenta;
  creadaEl: string;
  pagadaEl: string | null;
  notaPago: string | null;
  /** Licencia: espacio del cliente (si ya se registro) y hasta cuando esta pagado. */
  espacio: { id: string; nombre: string; estado: string; vence: string | null } | null;
  /** El cliente aun no ha usado el enlace de registro. */
  sinRegistrar: boolean;
  /** Ruta del comprobante en el bucket privado payment-proofs (se firma al mostrarlo). */
  comprobantePath: string | null;
};

type Fila = {
  id: string;
  vendedor_id: string;
  contact_id: string | null;
  conversation_id: string | null;
  invitacion_id: string | null;
  cliente_workspace_id: string | null;
  payment_id: string | null;
  plan_id: string | null;
  monto_cents: number;
  comision_pct: number;
  comision_cents: number;
  estado: EstadoVenta;
  created_at: string;
  pagada_at: string | null;
  nota_pago: string | null;
};

/**
 * Ventas con todo lo que las pantallas necesitan. Con el cliente de servicio: la
 * pantalla que lo llama ya decidio que puede ver (el admin todas, el vendedor
 * solo las suyas: `soloDe`).
 */
export async function cargarVentas(admin: SupabaseClient, opciones: { soloDe?: string; limite?: number } = {}): Promise<VentaVista[]> {
  let consulta = admin
    .from("ventas_vendedor")
    .select("id, vendedor_id, contact_id, conversation_id, invitacion_id, cliente_workspace_id, payment_id, plan_id, monto_cents, comision_pct, comision_cents, estado, created_at, pagada_at, nota_pago")
    .order("created_at", { ascending: false })
    .limit(opciones.limite ?? 300);
  if (opciones.soloDe) consulta = consulta.eq("vendedor_id", opciones.soloDe);
  const { data } = await consulta;
  const filas = (data ?? []) as Fila[];
  if (!filas.length) return [];

  const unicos = <T,>(xs: (T | null)[]) => [...new Set(xs.filter((x): x is T => x !== null))];
  const invitacionIds = unicos(filas.map((f) => f.invitacion_id));
  const pagoIds = unicos(filas.map((f) => f.payment_id));
  const [{ data: contactos }, { data: planes }, { data: invitaciones }, { data: pagos }] = await Promise.all([
    admin.from("contacts").select("id, name, wa_id").in("id", unicos(filas.map((f) => f.contact_id))),
    admin.from("plans").select("id, name").in("id", unicos(filas.map((f) => f.plan_id))),
    invitacionIds.length
      ? admin.from("invitaciones_registro").select("id, status, workspace_id, proof_path").in("id", invitacionIds)
      : Promise.resolve({ data: [] as { id: string; status: string; workspace_id: string | null; proof_path: string | null }[] }),
    pagoIds.length
      ? admin.from("payments").select("id, proof_path").in("id", pagoIds)
      : Promise.resolve({ data: [] as { id: string; proof_path: string | null }[] }),
  ]);
  const pagoPorId = new Map((pagos ?? []).map((p) => [p.id as string, (p.proof_path as string | null) ?? null]));
  const invPorId = new Map((invitaciones ?? []).map((i) => [i.id as string, i]));

  const espacioIds = unicos(
    filas.map((f) => f.cliente_workspace_id ?? ((invPorId.get(f.invitacion_id ?? "")?.workspace_id as string | null) ?? null))
  );
  const [{ data: espacios }, { data: subs }] = espacioIds.length
    ? await Promise.all([
        admin.from("workspaces").select("id, name, status").in("id", espacioIds),
        admin.from("subscriptions").select("workspace_id, current_period_end").in("workspace_id", espacioIds).eq("status", "active"),
      ])
    : [{ data: [] }, { data: [] }];

  const nombres = new Map<string, string>();
  for (const id of unicos(filas.map((f) => f.vendedor_id))) {
    const { data: u } = await admin.auth.admin.getUserById(id);
    const meta = u.user?.user_metadata as { full_name?: string } | undefined;
    nombres.set(id, meta?.full_name?.trim() || u.user?.email || "Vendedor");
  }

  const contPorId = new Map((contactos ?? []).map((c) => [c.id as string, c]));
  const planPorId = new Map((planes ?? []).map((p) => [p.id as string, p.name as string]));
  const espPorId = new Map((espacios ?? []).map((e) => [e.id as string, e]));
  const vencePorEsp = new Map<string, string>();
  for (const s of (subs ?? []) as { workspace_id: string; current_period_end: string | null }[]) {
    const previo = vencePorEsp.get(s.workspace_id);
    if (s.current_period_end && (!previo || s.current_period_end > previo)) vencePorEsp.set(s.workspace_id, s.current_period_end);
  }

  return filas.map((f) => {
    const c = f.contact_id ? contPorId.get(f.contact_id) : undefined;
    const inv = f.invitacion_id ? invPorId.get(f.invitacion_id) : undefined;
    const espacioId = f.cliente_workspace_id ?? (inv?.workspace_id as string | null) ?? null;
    const e = espacioId ? espPorId.get(espacioId) : undefined;
    const prueba = (inv?.proof_path as string | null) ?? (f.payment_id ? pagoPorId.get(f.payment_id) ?? null : null);
    return {
      id: f.id,
      vendedorId: f.vendedor_id,
      vendedorNombre: nombres.get(f.vendedor_id) ?? "Vendedor",
      cliente: (c?.name as string | null)?.trim() || (c?.wa_id as string | undefined) || "Cliente",
      telefono: (c?.wa_id as string | undefined) ?? null,
      conversationId: f.conversation_id,
      plan: planPorId.get(f.plan_id ?? "") ?? "—",
      montoCents: Number(f.monto_cents),
      comisionPct: Number(f.comision_pct),
      comisionCents: Number(f.comision_cents),
      estado: f.estado,
      creadaEl: f.created_at,
      pagadaEl: f.pagada_at,
      notaPago: f.nota_pago,
      espacio: e ? { id: e.id as string, nombre: e.name as string, estado: e.status as string, vence: vencePorEsp.get(e.id as string) ?? null } : null,
      sinRegistrar: !!inv && inv.status === "pending",
      comprobantePath: prueba,
    };
  });
}
