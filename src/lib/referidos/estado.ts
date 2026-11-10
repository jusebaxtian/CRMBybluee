import type { SupabaseClient } from "@supabase/supabase-js";

/** Meses gratis que un espacio puede ganar por referidos, de por vida. */
export const TOPE_REFERIDOS = 3;

export const URL_BASE_REFERIDOS = "https://crmbybluee.blue";

export function enlaceDeReferido(codigo: string): string {
  return `${URL_BASE_REFERIDOS}/signup?ref=${codigo}`;
}

/** Los codigos son 8 caracteres sin letras ni numeros que se confunden (0, 1, I, O). */
export function normalizarCodigoDeReferido(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const codigo = valor.trim().toUpperCase();
  return /^[A-HJ-NP-Z2-9]{8}$/.test(codigo) ? codigo : null;
}

export type CasillaDeReferido = "usado" | "disponible" | "en_revision" | "libre";

/** Las tres casillas de la tarjeta, en orden: usados, disponibles, en revision y libres. */
export function casillasDeReferidos(r: { usados: number; disponibles: number; enRevision: number }): CasillaDeReferido[] {
  const casillas: CasillaDeReferido[] = [
    ...Array<CasillaDeReferido>(r.usados).fill("usado"),
    ...Array<CasillaDeReferido>(r.disponibles).fill("disponible"),
    ...Array<CasillaDeReferido>(r.enRevision).fill("en_revision"),
  ];
  while (casillas.length < TOPE_REFERIDOS) casillas.push("libre");
  return casillas.slice(0, TOPE_REFERIDOS);
}

export type ResumenDeReferidos = {
  codigo: string;
  usados: number;
  disponibles: number;
  enRevision: number;
};

/**
 * Lo que necesita la tarjeta. `elegible` es verdadero para quien tiene la
 * licencia activa y un plan de pago: todos menos DEMO (precio 0) o sin plan.
 * Desde el 10 nov 2026 no hace falta un pago registrado en el CRM: clientes del
 * plan Inicial que pagaron por fuera no veian la invitacion.
 */
export async function cargarReferidos(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<{ elegible: boolean; resumen: ResumenDeReferidos | null; disponibles: number }> {
  const [{ data: espacio }, { data: premios }] = await Promise.all([
    supabase.from("workspaces").select("status, referral_code, plans(price_cents)").eq("id", workspaceId).maybeSingle(),
    supabase.from("referral_rewards").select("status").eq("referrer_id", workspaceId),
  ]);

  const cuenta = (estado: string) => (premios ?? []).filter((p) => p.status === estado).length;
  const disponibles = cuenta("disponible");
  const codigo = (espacio?.referral_code as string | null) ?? null;
  const precioPlan = Number((espacio?.plans as unknown as { price_cents: number } | null)?.price_cents ?? 0);
  const elegible = !!codigo && espacio?.status === "active" && precioPlan > 0;

  return {
    elegible,
    disponibles,
    resumen: codigo ? { codigo, usados: cuenta("usado"), disponibles, enRevision: cuenta("en_revision") } : null,
  };
}
