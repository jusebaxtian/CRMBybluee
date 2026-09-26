/**
 * El limite de 1.024 caracteres del cuerpo de una plantilla.
 *
 * WhatsApp no mide la plantilla como se guarda, sino el mensaje ya armado: con
 * las variables reemplazadas por su valor real. Una plantilla de 1.016
 * caracteres mas "{{1}}" pasa la aprobacion de Meta sin problema y despues
 * falla en cada envio con el error 132005, porque cualquier nombre de 9
 * caracteres la empuja arriba de 1.024.
 *
 * Le paso exactamente eso a GC Solutions: dos plantillas aprobadas, 746
 * destinatarios fallidos en dos dias, y en `cremil_geo_pichi` la frontera se
 * podia ver a ojo — los nombres de 15 caracteres salian y los de 16 fallaban.
 *
 * De ahi que haya dos umbrales y no uno. Bloquear todo lo que *podria*
 * pasarse habria dejado inservibles plantillas que hoy envian bien, como
 * `marisol_cremil_pichincha`; y avisar solamente no evita el envio que falla
 * 181 de 181. Asi que:
 *
 * - No se puede usar: no le cabe ni un nombre corriente. Falla siempre.
 * - Queda justo: le caben los nombres normales, pero uno largo la revienta.
 */
export const LIMITE_CUERPO = 1024;

/**
 * Lo minimo que tiene que caber en una variable para considerar la plantilla
 * usable. El nombre de contacto mas largo en produccion tiene 25 caracteres:
 * una plantilla donde no entra eso no sirve para nadie.
 */
export const MINIMO_POR_VARIABLE = 25;

/**
 * Espacio que conviene apartar por variable: el valor mas largo que se espera
 * ver ahi, con margen para razones sociales y no solo nombres de persona.
 */
export const RESERVA_POR_VARIABLE = 60;

const VARIABLE = /\{\{\s*\d+\s*\}\}/g;

/** Las variables distintas que usa el texto: {{1}}, {{2}}... sin repetir. */
export function variablesDe(texto: string): string[] {
  const encontradas = texto.match(VARIABLE) ?? [];
  const normalizadas = encontradas.map((v) => v.replace(/\s/g, ""));
  return [...new Set(normalizadas)];
}

/** Lo que ocupa el texto fijo, sin contar los marcadores de variable. */
export function largoFijo(texto: string): number {
  return texto.replace(VARIABLE, "").length;
}

/** Lo que mediria el mensaje armado si cada variable ocupara `porVariable`. */
export function largoConVariablesDe(texto: string, porVariable: number): number {
  return largoFijo(texto) + variablesDe(texto).length * porVariable;
}

/** Lo que puede llegar a medir en el peor caso previsible. */
export function largoEnElPeorCaso(texto: string): number {
  return largoConVariablesDe(texto, RESERVA_POR_VARIABLE);
}

/** Lo que queda libre en el peor caso. Negativo cuando ya no cabe. */
export function margenRestante(texto: string): number {
  return LIMITE_CUERPO - largoEnElPeorCaso(texto);
}

/** Los caracteres que le caben a cada variable antes de pasarse del limite. */
export function espacioPorVariable(texto: string): number {
  const variables = variablesDe(texto).length;
  if (variables === 0) return 0;
  return Math.floor((LIMITE_CUERPO - largoFijo(texto)) / variables);
}

/**
 * Plantilla inservible: ni con un nombre corriente cabe en el limite, asi que
 * el envio falla siempre. El CRM no la ofrece para elegir aunque Meta la tenga
 * aprobada — fallar 181 de 181 destinatarios sale mas caro que no poder
 * enviar.
 */
export function noSePuedeUsar(texto: string | null | undefined): boolean {
  if (!texto) return false;
  return largoConVariablesDe(texto, MINIMO_POR_VARIABLE) > LIMITE_CUERPO;
}

/**
 * Plantilla al borde: los nombres normales pasan, uno largo la tumba. Se deja
 * usar, con aviso, porque hoy hay plantillas asi enviando bien.
 */
export function quedaJusto(texto: string | null | undefined): boolean {
  if (!texto) return false;
  return !noSePuedeUsar(texto) && margenRestante(texto) < 0;
}

/** Explicacion para la plantilla que no se puede usar, con sus numeros. */
export function motivoDelExceso(texto: string): string {
  const fijo = largoFijo(texto);
  const variables = variablesDe(texto).length;
  if (variables === 0) {
    return `El cuerpo mide ${fijo} caracteres y WhatsApp permite ${LIMITE_CUERPO}. Recorta al menos ${fijo - LIMITE_CUERPO}.`;
  }
  const cabe = espacioPorVariable(texto);
  const recortar = largoConVariablesDe(texto, MINIMO_POR_VARIABLE) - LIMITE_CUERPO;
  return `WhatsApp permite ${LIMITE_CUERPO} caracteres en el mensaje ya armado, con las variables reemplazadas. El texto fijo ocupa ${fijo}, así que a cada variable solo le quedan ${cabe} caracteres y un nombre normal no cabe. Recorta al menos ${recortar} caracteres del cuerpo.`;
}

/** Aviso para la plantilla que queda justa pero todavia sirve. */
export function avisoDeMargenJusto(texto: string): string {
  const cabe = espacioPorVariable(texto);
  return `Queda justa: a cada variable le caben ${cabe} caracteres. Con un nombre más largo que eso, ese envío falla. Recorta ${-margenRestante(texto)} caracteres para quedar tranquilo.`;
}
