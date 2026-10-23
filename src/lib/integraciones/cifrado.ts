import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Cifrado de los secretos de las integraciones (el token de Google de cada
 * usuario). AES-256-GCM con una llave del servidor (INTEGRATIONS_ENCRYPTION_KEY,
 * 32 bytes en base64): en la base solo queda el texto cifrado, y sin la llave
 * no sirve de nada aunque se filtre una copia.
 *
 * Formato: v1.<iv>.<etiqueta>.<cifrado>, todo en base64url.
 */

function llave(): Buffer {
  const b64 = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!b64) throw new Error("Falta INTEGRATIONS_ENCRYPTION_KEY en el servidor.");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("INTEGRATIONS_ENCRYPTION_KEY debe ser de 32 bytes en base64.");
  return k;
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", llave(), iv);
  const cifrado = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  const etiqueta = c.getAuthTag();
  return ["v1", iv.toString("base64url"), etiqueta.toString("base64url"), cifrado.toString("base64url")].join(".");
}

export function descifrar(valor: string): string {
  const [version, iv, etiqueta, cifrado] = valor.split(".");
  if (version !== "v1" || !iv || !etiqueta || !cifrado) throw new Error("Formato de secreto no reconocido.");
  const d = createDecipheriv("aes-256-gcm", llave(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(etiqueta, "base64url"));
  return Buffer.concat([d.update(Buffer.from(cifrado, "base64url")), d.final()]).toString("utf8");
}

// ---------------------------------------------------------------------------
// Estado firmado del flujo OAuth: evita que alguien enlace SU Google a la cuenta
// de otra persona (CSRF). Lleva el usuario y un vencimiento de 10 minutos.
// ---------------------------------------------------------------------------

const VIGENCIA_ESTADO_MS = 10 * 60_000;

function firma(carga: string): string {
  return createHmac("sha256", llave()).update(carga).digest("base64url");
}

export function firmarEstado(userId: string, ahoraMs = Date.now()): string {
  const carga = Buffer.from(JSON.stringify({ u: userId, n: randomBytes(12).toString("base64url"), e: ahoraMs + VIGENCIA_ESTADO_MS })).toString("base64url");
  return `${carga}.${firma(carga)}`;
}

/** El usuario del estado, o null si la firma no cuadra o ya venció. */
export function leerEstado(estado: string, ahoraMs = Date.now()): string | null {
  const [carga, f] = estado.split(".");
  if (!carga || !f) return null;
  const esperada = Buffer.from(firma(carga));
  const recibida = Buffer.from(f);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  try {
    const { u, e } = JSON.parse(Buffer.from(carga, "base64url").toString("utf8")) as { u?: string; e?: number };
    if (!u || typeof e !== "number" || e < ahoraMs) return null;
    return u;
  } catch {
    return null;
  }
}
