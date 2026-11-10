import type { createAdminClient } from "@/lib/supabase/admin";
import { productoDeReferencia, type EstadoBold } from "@/lib/bold-pagos";
import type { FilaPagoBold } from "@/components/admin/pagos-bold";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * La lista de Admin -> Pagos: los avisos de Bold (0180) y, para lo que se pago
 * antes de que existieran, las compras de plan y curso que el CRM ya tenia.
 */
export async function listarPagosBold(admin: Admin, limite = 300): Promise<FilaPagoBold[]> {
  const [{ data: avisos }, { data: planes }, { data: cursos }] = await Promise.all([
    admin
      .from("bold_pagos")
      .select("payment_id, estado, monto, currency, metodo, integracion, referencia, correo_pagador, pagado_el, created_at")
      .order("created_at", { ascending: false })
      .limit(limite),
    admin
      .from("payments")
      .select("bold_order_id, status, amount_cents, created_at, reviewed_at, workspaces(name), plans(name)")
      .eq("provider", "bold")
      .not("bold_order_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000),
    admin
      .from("curso_compras")
      .select("bold_order_id, status, monto_cents, currency, created_at, revisado_en, workspaces(name), cursos(titulo)")
      .eq("metodo", "bold")
      .not("bold_order_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const nombre = (x: unknown, campo: string) => ((x as Record<string, string> | null)?.[campo] ?? null) as string | null;
  const planPorOrden = new Map<string, string>();
  const espacioPorOrden = new Map<string, string | null>();
  for (const p of planes ?? []) {
    const orden = p.bold_order_id as string;
    planPorOrden.set(orden, `Plan ${nombre(p.plans, "name") ?? ""}`.trim());
    espacioPorOrden.set(orden, nombre(p.workspaces, "name"));
  }
  const cursoPorOrden = new Map<string, string>();
  for (const c of cursos ?? []) {
    const orden = c.bold_order_id as string;
    cursoPorOrden.set(orden, `Curso: ${nombre(c.cursos, "titulo") ?? "—"}`);
    espacioPorOrden.set(orden, nombre(c.workspaces, "name"));
  }

  const filas: FilaPagoBold[] = [];
  const vistas = new Set<string>();
  for (const a of avisos ?? []) {
    const ref = (a.referencia as string | null) ?? null;
    if (ref) vistas.add(ref);
    const producto = productoDeReferencia(ref, planPorOrden, cursoPorOrden);
    const espacio = ref ? espacioPorOrden.get(ref) : null;
    const correo = (a.correo_pagador as string | null) ?? null;
    filas.push({
      clave: `b-${a.payment_id}`,
      fecha: ((a.pagado_el as string | null) ?? a.created_at) as string,
      producto: producto.texto,
      tipo: producto.tipo,
      quien: [espacio, correo].filter(Boolean).join(" · ") || null,
      metodo: (a.metodo as string | null) ?? null,
      canal: (a.integracion as string | null) ?? null,
      monto: a.monto === null ? null : Number(a.monto),
      currency: (a.currency as string | null) ?? null,
      estado: a.estado as EstadoBold,
      referencia: ref,
    });
  }

  // Lo pagado antes de guardar los avisos: solo lo que ya quedo resuelto. Las
  // ordenes pendientes son botones que se abrieron y no se pagaron.
  const estadoCrm = (s: string): EstadoBold | null => (s === "approved" ? "aprobado" : s === "rejected" ? "rechazado" : null);
  for (const p of planes ?? []) {
    const orden = p.bold_order_id as string;
    const estado = estadoCrm(p.status as string);
    if (!estado || vistas.has(orden)) continue;
    filas.push({
      clave: `p-${orden}`,
      fecha: ((p.reviewed_at as string | null) ?? p.created_at) as string,
      producto: planPorOrden.get(orden)!,
      tipo: "plan",
      quien: espacioPorOrden.get(orden) ?? null,
      metodo: null,
      canal: "BUTTON",
      monto: Number(p.amount_cents) / 100,
      currency: "COP",
      estado,
      referencia: orden,
    });
  }
  for (const c of cursos ?? []) {
    const orden = c.bold_order_id as string;
    const estado = estadoCrm(c.status as string);
    if (!estado || vistas.has(orden)) continue;
    filas.push({
      clave: `c-${orden}`,
      fecha: ((c.revisado_en as string | null) ?? c.created_at) as string,
      producto: cursoPorOrden.get(orden)!,
      tipo: "curso",
      quien: espacioPorOrden.get(orden) ?? null,
      metodo: null,
      canal: "BUTTON",
      monto: Number(c.monto_cents) / 100,
      currency: (c.currency as string | null) ?? "COP",
      estado,
      referencia: orden,
    });
  }

  return filas.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, limite);
}
