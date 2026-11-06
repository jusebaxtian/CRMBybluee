/**
 * Quita de la respuesta los datos de pago que no salen de ninguna fuente real.
 *
 * Probado el 5 nov 2026 con gpt-4o-mini: escribio un Nequi inventado en una prueba y
 * "Nequi: 300xxxxx" a un cliente real, aunque las instrucciones lo prohiben. Un
 * cliente podria pagarle a un desconocido, asi que no depende de que el modelo obedezca.
 */
const NUMERO_LARGO = /\d[\d\s.\-]{5,}\d/g;
const soloDigitos = (s: string) => s.replace(/\D/g, "");

const MEDIO_DE_PAGO = /nequi|daviplata|llave|bre-?b|bancolombia|transferencia|consignaci[oó]n|cuenta/i;
/** "300xxxxx" o "#####": un dato de relleno que el modelo dejo sin completar. */
const DATO_DE_RELLENO = /\d*x{2,}\d*|#{2,}|\[[^\]]*(n[uú]mero|cuenta|llave)[^\]]*\]/i;
const OFRECE_MEDIOS = /(te|les?)\s+(dejo|paso|env[ií]o|mando|comparto)[^\n]{0,30}(medios?|formas?|datos?)\s+de\s+pago/i;

export function quitarNumerosInventados(respuesta: string, fuentes: string): { texto: string; quito: boolean } {
  // Se compara contra todos los digitos de las fuentes: un numero real puede venir
  // escrito con otros separadores que el de la respuesta.
  const digitosDeLasFuentes = soloDigitos(fuentes);
  const esConocido = (n: string) => digitosDeLasFuentes.includes(n);

  let quito = false;
  const lineas = respuesta.split("\n").filter((linea) => {
    const inventado = (linea.match(NUMERO_LARGO) ?? []).map(soloDigitos).some((n) => n.length >= 7 && !esConocido(n));
    const relleno = MEDIO_DE_PAGO.test(linea) && DATO_DE_RELLENO.test(linea);
    if (inventado || relleno) quito = true;
    return !inventado && !relleno;
  });
  return { texto: lineas.join("\n").replace(/\n{3,}/g, "\n\n").trim(), quito };
}

/** Le esta dando o prometiendo los medios de pago: con eso siempre va la imagen del QR. */
export function entregaMediosDePago(respuesta: string): boolean {
  if (OFRECE_MEDIOS.test(respuesta)) return true;
  return respuesta.split("\n").some((l) => MEDIO_DE_PAGO.test(l) && (l.match(NUMERO_LARGO) ?? []).some((n) => soloDigitos(n).length >= 7));
}
