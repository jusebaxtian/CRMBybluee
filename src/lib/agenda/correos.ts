import { correoValido } from "@/lib/agenda/tiempo";

/** Cuantos invitados admite una cita. Google acepta mas, pero mas de 20 es casi siempre un error de pegado. */
export const MAX_INVITADOS = 20;

/** Parte un texto pegado ("a@x.com, b@y.com; c@z.com") en correos sueltos. */
export function separarCorreos(texto: string): string[] {
  return texto
    .split(/[\s,;]+/)
    .map((c) => c.trim().replace(/^[<"']+|[>"']+$/g, ""))
    .filter(Boolean);
}

/**
 * Deja la lista limpia: en minusculas, sin repetidos, validada. Si alguno no es un
 * correo, devuelve cual para decirselo a la persona en vez de descartarlo en silencio.
 */
export function normalizarCorreos(lista: string[]): { correos: string[] } | { error: string } {
  const vistos = new Set<string>();
  const correos: string[] = [];
  for (const crudo of lista) {
    const c = crudo.trim().toLowerCase();
    if (!c) continue;
    if (!correoValido(c)) return { error: `"${crudo.trim()}" no es un correo válido.` };
    if (vistos.has(c)) continue;
    vistos.add(c);
    correos.push(c);
  }
  if (correos.length > MAX_INVITADOS) return { error: `Máximo ${MAX_INVITADOS} invitados por cita.` };
  return { correos };
}

/** Agrega correos a la lista actual (para el campo de varios correos), sin repetir. */
export function agregarCorreos(actual: string[], texto: string): { lista: string[]; rechazado?: string } {
  const lista = [...actual];
  for (const c of separarCorreos(texto)) {
    const minus = c.toLowerCase();
    if (!correoValido(minus)) return { lista, rechazado: c };
    if (!lista.includes(minus)) lista.push(minus);
  }
  return { lista };
}
