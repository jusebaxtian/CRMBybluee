import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mensual, semestral o anual: lo que el cliente compro, para verlo de un vistazo
 * en la bandeja del administrador.
 *
 * No sale del nombre ni del ciclo del plan: ningun plan es "anual" y 31 clientes
 * con plan mensual o semestral tienen un vencimiento a casi un ano. Sale de los
 * dias entre su ULTIMO PAGO APROBADO y su vencimiento, que es el periodo que
 * realmente pagaron. Asi no cambia de un dia para otro mientras se acerca la
 * fecha, a diferencia de calcularlo con lo que le queda.
 *
 * Sin pago aprobado (cortesias, demos, activaciones manuales) o sin plan vigente
 * no hay etiqueta: se deja la bandeja como estaba.
 */
export type Ciclo = "mensual" | "semestral" | "anual" | "demo";

/** Hasta cuantos dias entre pago y vencimiento cuenta como cada ciclo. */
const HASTA_MENSUAL = 45;
const HASTA_SEMESTRAL = 220;

const DIA_MS = 86_400_000;

export function cicloDePlan(
  fila: { status: string; vence: string | null; ultimo_pago: string | null; es_demo?: boolean },
  ahora: Date = new Date()
): Ciclo | null {
  if (fila.status !== "active" || !fila.vence) return null;
  // Una cuenta DEMO vigente se etiqueta DEMO, tenga o no pagos: aun no compro.
  if (fila.es_demo) {
    const venceDemo = new Date(fila.vence).getTime();
    return !Number.isNaN(venceDemo) && venceDemo > ahora.getTime() ? "demo" : null;
  }
  if (!fila.ultimo_pago) return null;
  const vence = new Date(fila.vence).getTime();
  const pago = new Date(fila.ultimo_pago).getTime();
  if (Number.isNaN(vence) || Number.isNaN(pago)) return null;
  // Un plan que ya vencio no tiene etiqueta, aunque el estado tarde unos minutos en cambiar.
  if (vence <= ahora.getTime() || vence <= pago) return null;
  const dias = (vence - pago) / DIA_MS;
  if (dias <= HASTA_MENSUAL) return "mensual";
  if (dias <= HASTA_SEMESTRAL) return "semestral";
  return "anual";
}

/**
 * Ciclo de cada cliente del administrador, por numero de WhatsApp.
 *
 * Una sola llamada trae todos (son ~80), asi la lista de conversaciones no
 * necesita pedirlos pagina por pagina. La funcion de la base solo responde al
 * administrador; para cualquier otro usuario devuelve vacio.
 */
export async function cargarCiclos(supabase: SupabaseClient, ahora: Date = new Date()): Promise<Record<string, Ciclo>> {
  const { data } = await supabase.rpc("admin_ciclos_de_clientes");
  return agruparCiclos((data ?? []) as FilaDeCiclo[], ahora);
}

type FilaDeCiclo = { wa_id: string; status: string; vence: string | null; ultimo_pago: string | null; es_demo?: boolean };

/** Si un numero esta en varios espacios, vale el que vence mas tarde. */
export function agruparCiclos(
  filas: FilaDeCiclo[],
  ahora: Date = new Date()
): Record<string, Ciclo> {
  const mejor = new Map<string, { ciclo: Ciclo; vence: number }>();
  for (const f of filas) {
    const ciclo = cicloDePlan(f, ahora);
    if (!ciclo || !f.vence) continue;
    const vence = new Date(f.vence).getTime();
    const actual = mejor.get(f.wa_id);
    if (!actual || vence > actual.vence) mejor.set(f.wa_id, { ciclo, vence });
  }
  return Object.fromEntries([...mejor].map(([wa, v]) => [wa, v.ciclo]));
}
