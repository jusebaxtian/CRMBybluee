import type { createAdminClient } from "@/lib/supabase/admin";
import { ESTILO_ETAPA, esEtapa, type Etapa } from "@/lib/leads/etapas";

type Supabase = ReturnType<typeof createAdminClient>;

/**
 * Agente vendedor del espacio (Juanes, migracion 0169): atiende todos los chats y
 * lleva al cliente de frio a tibio, a caliente y al pago.
 */
export type EspacioDelContacto = {
  workspace_name: string;
  status: string;
  plan_name: string | null;
  vence: string | null;
  lineas: number;
};

export type ContextoDelCliente = {
  nombre: string | null;
  etapa: Etapa | null;
  notas: string | null;
  etiquetas: string[];
  espacios: EspacioDelContacto[];
};

/** Que debe lograr el agente con el cliente segun su etapa. */
const OBJETIVO: Record<Etapa, string> = {
  frio: "Acaba de llegar. Salúdalo, entiende qué negocio tiene y qué necesita, y despierta su interés. Llévalo a conocer los planes y el precio.",
  tibio: "Ya conoce el precio. Resuelve sus dudas y objeciones, ayúdalo a elegir el plan que le sirve y llévalo a pedir los medios de pago.",
  caliente: "Ya tiene los medios de pago. Acompáñalo a pagar, resuelve lo que lo frene y pídele que envíe el comprobante.",
  pago: "Ya pagó. Agradécele y ayúdalo con lo que necesite. No le vendas lo que ya compró.",
};

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" });

/** Lo que se le agrega a las instrucciones: el objetivo y lo que se sabe del cliente. */
export function seccionDeVenta(c: ContextoDelCliente): string {
  const datos: string[] = [];
  if (c.nombre?.trim()) datos.push(`- Nombre: ${c.nombre.trim()}`);
  if (c.etapa) datos.push(`- Etapa actual: ${ESTILO_ETAPA[c.etapa].texto}. ${OBJETIVO[c.etapa]}`);
  if (c.etiquetas.length > 0) datos.push(`- Etiquetas: ${c.etiquetas.join(", ")}`);
  if (c.notas?.trim()) datos.push(`- Notas del equipo: ${c.notas.trim().slice(0, 500)}`);
  for (const e of c.espacios) {
    const vence = e.vence ? `, vence el ${fechaCorta(e.vence)}` : "";
    datos.push(
      `- Ya tiene una cuenta en la plataforma: "${e.workspace_name}", plan ${e.plan_name ?? "sin plan"}, estado ${e.status}${vence}, ${e.lineas} línea(s) de WhatsApp conectada(s).`
    );
  }

  return `

TU OBJETIVO: vender. Lleva al cliente paso a paso: de frío (acaba de llegar) a tibio (conoce el precio), de tibio a caliente (tiene los medios de pago) y de caliente al pago. Avanza un paso a la vez, sin presionar.

LO QUE SABES DE ESTE CLIENTE (es interno: úsalo para atenderlo mejor, pero nunca le menciones etapas, etiquetas ni notas):
${datos.length > 0 ? datos.join("\n") : "- Todavía no hay datos de este cliente."}

Si el cliente ya tiene cuenta y necesita soporte, ayúdalo con lo que sepas de ella. No inventes datos de su cuenta ni prometas cambios: si no puedes resolverlo, pásalo a una persona con la regla obligatoria de arriba.`;
}

/** Encendido atiende a todos; apagado, solo los numeros de prueba. */
export function vendedorAtiende(
  vendedor: { activo: boolean; numeros_prueba?: string[] | null } | null | undefined,
  waId: string | null | undefined
): boolean {
  if (!vendedor) return false;
  return vendedor.activo || (!!waId && (vendedor.numeros_prueba ?? []).includes(waId));
}

/** Los numeros tal como se guardan en WhatsApp: solo digitos y con el 57 de Colombia. */
export function limpiarNumerosDePrueba(entrada: string): string[] {
  const numeros = entrada
    .split(/[,;\n]+/)
    .map((n) => n.replace(/\D/g, ""))
    .map((n) => (n.length === 10 ? `57${n}` : n))
    .filter((n) => n.length >= 11);
  return [...new Set(numeros)];
}

/** El agente vendedor del espacio, con la llave ya conectada. Null si no hay o no tiene llave. */
export async function vendedorDelEspacio(supabase: Supabase, workspaceId: string) {
  const { data: vendedor } = await supabase
    .from("agente_vendedor")
    .select("nombre, activo, instrucciones, voz_activa, voz_id, numeros_prueba")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!vendedor) return null;
  const conexion = await conexionDeIa(supabase, workspaceId);
  if (!conexion) return null;
  return { ...vendedor, ...conexion };
}

/** La llave de IA ya conectada en el espacio. Prefiere OpenAI: tambien transcribe notas de voz. */
export async function conexionDeIa(supabase: Supabase, workspaceId: string) {
  const { data: agentes } = await supabase
    .from("ai_agents")
    .select("provider, api_key, model")
    .eq("workspace_id", workspaceId)
    .order("created_at");
  const conLlave = (agentes ?? []).filter((a) => a.api_key);
  const elegida = conLlave.find((a) => a.provider === "openai") ?? conLlave[0];
  if (!elegida) return null;
  return { provider: elegida.provider as "openai" | "anthropic", api_key: elegida.api_key as string, model: elegida.model as string };
}

export async function contextoDelCliente(supabase: Supabase, contactId: string): Promise<ContextoDelCliente> {
  const [{ data: contacto }, { data: lead }, { data: espacios }] = await Promise.all([
    supabase.from("contacts").select("name, notes, contact_tags(tags(name))").eq("id", contactId).maybeSingle(),
    supabase.from("lead_etapas").select("etapa").eq("contact_id", contactId).maybeSingle(),
    supabase.rpc("espacios_del_contacto", { p_contact_id: contactId }),
  ]);
  const etiquetas = ((contacto?.contact_tags ?? []) as unknown as { tags: { name: string } | null }[])
    .map((t) => t.tags?.name)
    .filter((n): n is string => !!n);
  return {
    nombre: (contacto?.name as string | null) ?? null,
    etapa: esEtapa(lead?.etapa) ? lead.etapa : null,
    notas: (contacto?.notes as string | null) ?? null,
    etiquetas,
    espacios: (espacios ?? []) as EspacioDelContacto[],
  };
}
