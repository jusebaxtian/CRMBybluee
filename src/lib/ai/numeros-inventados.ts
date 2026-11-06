/**
 * Quita de la respuesta los numeros largos que no salen de ninguna fuente real.
 *
 * Probado el 5 nov 2026: al pedirle pagar, gpt-4o-mini escribio cuatro medios de
 * pago con un Nequi inventado, aunque las instrucciones lo prohiben. Un cliente le
 * habria pagado a un desconocido, asi que no puede depender de que el modelo obedezca.
 */
const NUMERO_LARGO = /\d[\d\s.\-]{5,}\d/g;
const soloDigitos = (s: string) => s.replace(/\D/g, "");

export function quitarNumerosInventados(respuesta: string, fuentes: string): { texto: string; quito: boolean } {
  // Se compara contra todos los digitos de las fuentes: un numero real puede venir
  // escrito con otros separadores que el de la respuesta.
  const digitosDeLasFuentes = soloDigitos(fuentes);
  const esConocido = (n: string) => digitosDeLasFuentes.includes(n);

  let quito = false;
  const lineas = respuesta.split("\n").filter((linea) => {
    const inventado = (linea.match(NUMERO_LARGO) ?? []).map(soloDigitos).some((n) => n.length >= 7 && !esConocido(n));
    if (inventado) quito = true;
    return !inventado;
  });
  return { texto: lineas.join("\n").replace(/\n{3,}/g, "\n\n").trim(), quito };
}
