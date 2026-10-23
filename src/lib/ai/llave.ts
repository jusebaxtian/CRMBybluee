/**
 * Comprobaciones de la API key del agente de IA antes de llamar al proveedor, y
 * traduccion de sus errores. Pura (sin red) para poder probarla.
 *
 * Que una llave de OpenAI llegue a Anthropic (o al reves) era la causa mas comun
 * del "invalid x-api-key": la llave del espacio se comparte entre agentes, y al
 * cambiar de proveedor dejando el campo vacio se reutilizaba la de OpenAI.
 */

export type Proveedor = "openai" | "anthropic";

export const MODELO_POR_DEFECTO: Record<Proveedor, string> = {
  openai: "gpt-4o-mini",
  // El identificador documentado por Anthropic para Sonnet 5.5.
  anthropic: "claude-sonnet-5-5",
};

const NOMBRE: Record<Proveedor, string> = { openai: "OpenAI (GPT)", anthropic: "Anthropic (Claude)" };

/** Motivo por el que la llave pegada no sirve para ese proveedor, o null si tiene buena pinta. */
export function errorDeFormatoDeLlave(proveedor: Proveedor, llave: string): string | null {
  const l = llave.trim();
  if (proveedor === "anthropic" && !l.startsWith("sk-ant-")) {
    return l.startsWith("sk-")
      ? "Esa llave es de OpenAI, no de Anthropic. Para Claude pega una API key de console.anthropic.com → API keys (empieza por sk-ant-)."
      : "Esa llave no parece de Anthropic: tiene que empezar por sk-ant-. Cópiala completa de console.anthropic.com → API keys.";
  }
  if (proveedor === "openai" && l.startsWith("sk-ant-")) {
    return "Esa llave es de Anthropic (Claude). Para GPT pega una API key de OpenAI (platform.openai.com → API keys), o cambia el proveedor a Claude.";
  }
  return null;
}

/** El agente ya guarda una llave de OTRO proveedor y no se pegó una nueva. */
export function errorDeLlaveHeredada(guardada: Proveedor, elegido: Proveedor): string | null {
  if (guardada === elegido) return null;
  return `La llave que tienes guardada es de ${NOMBRE[guardada]}. Para usar ${NOMBRE[elegido]} pega una API key nueva de ese proveedor.`;
}

/** Mensaje claro para los errores de Anthropic; el resto se deja como viene. */
export function mensajeDeErrorDeProveedor(proveedor: Proveedor, err: unknown, modelo: string): string {
  const status = (err as { status?: number } | null)?.status;
  const crudo = err instanceof Error ? err.message : "error desconocido";
  if (proveedor === "anthropic") {
    if (status === 401) return "Anthropic rechazó la API key: es inválida, está incompleta o fue revocada. Crea una nueva en console.anthropic.com → API keys y pégala completa, sin espacios.";
    if (status === 403) return "Anthropic no permite usar esta API key (revisa que tenga acceso y saldo en console.anthropic.com).";
    if (status === 404) return `Anthropic no reconoce el modelo «${modelo}». Déjalo vacío para usar el recomendado (${MODELO_POR_DEFECTO.anthropic}).`;
    if (status === 429) return "Anthropic respondió que la cuenta superó su límite o no tiene saldo. Revisa console.anthropic.com → Billing.";
  }
  return crudo;
}
