/**
 * Texto de una plantilla listo para mostrar en una vista previa.
 *
 * El cuerpo guardado trae las variables como {{1}}, {{2}}…, que no le dicen nada a quien
 * esta eligiendo la plantilla. Aqui se cambian por una etiqueta legible entre corchetes
 * ("[Nombre]") segun con que dato se rellena cada una al enviar.
 */

export type OrigenDeVariable = { origen?: string; ejemplo?: string } | null | undefined;

function etiquetaDe(origen: string | undefined, indice: number): string {
  if (origen === "nombre") return "Nombre";
  const m = /^variable(\d)$/.exec(origen ?? "");
  if (m) return `Variable ${m[1]}`;
  return indice === 1 ? "Nombre" : `Dato ${indice}`;
}

export function textoConVariables(cuerpo: string | null | undefined, variables?: OrigenDeVariable[] | null): string {
  if (!cuerpo) return "";
  return cuerpo.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n: string) => {
    const i = Number(n);
    return `[${etiquetaDe(variables?.[i - 1]?.origen, i)}]`;
  });
}

/** Cuantas variables tiene el cuerpo (por el numero mas alto). */
export function cuantasVariablesTiene(cuerpo: string | null | undefined): number {
  let max = 0;
  for (const m of (cuerpo ?? "").matchAll(/\{\{\s*(\d+)\s*\}\}/g)) max = Math.max(max, Number(m[1]));
  return max;
}
