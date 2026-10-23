import { createHash, randomInt } from "node:crypto";

/**
 * Llaves de API: "bbl_live_" + 40 caracteres al azar. En la base solo se guarda
 * la huella (sha256): la llave se ve una vez, al crearla, y no hay forma de
 * recuperarla despues. Como la llave ya es aleatoria y larga, una huella simple
 * basta (no hay contraseñas debiles que proteger con un hash lento).
 */

export const PREFIJO_LLAVE = "bbl_live_";
const ALFABETO = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generarLlave(): { llave: string; prefijo: string; huella: string } {
  // randomInt reparte parejo (sin sesgo) entre los 62 caracteres.
  let secreto = "";
  for (let i = 0; i < 40; i++) secreto += ALFABETO[randomInt(ALFABETO.length)];
  const llave = PREFIJO_LLAVE + secreto;
  return { llave, prefijo: llave.slice(0, PREFIJO_LLAVE.length + 4), huella: huellaDe(llave) };
}

export function huellaDe(llave: string): string {
  return createHash("sha256").update(llave).digest("hex");
}

/** La llave que viene en "Authorization: Bearer ...", o null si no hay una con la forma correcta. */
export function llaveDeLaCabecera(cabecera: string | null): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec((cabecera ?? "").trim());
  if (!m) return null;
  return m[1].startsWith(PREFIJO_LLAVE) && m[1].length >= PREFIJO_LLAVE.length + 20 ? m[1] : null;
}
