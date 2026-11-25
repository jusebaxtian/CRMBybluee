import { vendedorAtiende, type AlcanceDelVendedor } from "@/lib/ai/vendedor";

/**
 * Que agente de IA atiende un chat, para la marca "IA" de la bandeja (25 nov
 * 2026). Sigue la misma decision que `maybeRespondWithAiAgent`: el vendedor
 * (Juanes) si el chat entra en su seleccion; si no, el agente de la linea o el
 * general del espacio, y solo si esta encendido. No hay IA si el chat esta en
 * "atencion humana" (pausada o pidio una persona), si el contacto esta excluido
 * de automatizaciones o si la cuenta esta pausada por plan vencido. Puro.
 *
 * Devuelve el nombre del agente, o null si la IA no le responderia.
 */
export function iaDelChat(d: {
  vendedor: (AlcanceDelVendedor & { nombre: string }) | null;
  agentes: { agent_name: string | null; is_active: boolean; whatsapp_account_id: string | null }[];
  lineaId: string | null;
  asignadoA: string | null;
  waId: string | null;
  atencionHumana: boolean;
  contactoExcluido: boolean;
  espacioPausado: boolean;
}): string | null {
  if (d.espacioPausado || d.atencionHumana || d.contactoExcluido) return null;

  if (d.vendedor && vendedorAtiende(d.vendedor, d.waId, { lineaId: d.lineaId, asignadoA: d.asignadoA })) {
    return d.vendedor.nombre || "IA";
  }

  const agente =
    d.agentes.find((a) => d.lineaId && a.whatsapp_account_id === d.lineaId) ?? d.agentes.find((a) => !a.whatsapp_account_id) ?? null;
  if (!agente?.is_active) return null;
  return agente.agent_name?.trim() || "IA";
}
