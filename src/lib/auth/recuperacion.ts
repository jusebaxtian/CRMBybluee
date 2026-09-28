import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Recuperacion de contraseña por WhatsApp: reglas y numeros de un solo lugar.
 *
 * Todo lo que decide seguridad aqui esta junto a proposito. Repartirlo entre
 * la accion que manda el codigo y la que lo verifica es como se terminan
 * teniendo dos caducidades distintas.
 */

/** Minutos que vive el codigo. Tambien es lo que dice la plantilla de Meta. */
export const MINUTOS_DE_VIDA = 10;

/** Intentos fallidos antes de quemar el codigo. */
export const INTENTOS_MAXIMOS = 5;

/** Espera entre dos solicitudes para el mismo telefono. */
export const SEGUNDOS_ENTRE_ENVIOS = 60;

/** Solicitudes por telefono en una hora: evita usar esto como ametralladora. */
export const ENVIOS_POR_HORA = 5;

/** Minutos que vive el permiso para escribir la clave nueva, ya verificado. */
export const MINUTOS_DEL_PERMISO = 15;

/** Largo minimo de la contraseña nueva. El mismo que pide el registro. */
export const LARGO_MINIMO_CLAVE = 8;

/**
 * Codigo de 6 digitos con el generador criptografico, no con Math.random:
 * un codigo predecible es un codigo regalado. Puede empezar por cero.
 */
export function generarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Permiso de un solo uso para /restablecer. No viaja en la URL: va en cookie. */
export function generarPermiso(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Se guarda el hash, no el codigo. SHA-256 sin sal alcanza aqui — el valor es
 * efimero, de 6 digitos y con tope de intentos; lo que se evita es que quien
 * lea la tabla pueda usar un codigo vigente.
 */
export function hashDe(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

/** Comparacion en tiempo constante, para no filtrar el codigo por el reloj. */
export function coincide(hashGuardado: string, valor: string): boolean {
  const a = Buffer.from(hashGuardado, "utf8");
  const b = Buffer.from(hashDe(valor), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Solo digitos, como lo espera WhatsApp: "573001234567". */
export function soloDigitos(telefono: string): string {
  return telefono.replace(/\D/g, "");
}

/**
 * Lo que se muestra al pedir el codigo: "•••• ••67".
 *
 * Se tapa el numero a proposito. La pantalla tiene que confirmarle a la
 * persona que el codigo va a su WhatsApp, sin decirle a un desconocido cual
 * es el telefono del dueño de ese espacio.
 */
export function telefonoTapado(e164: string): string {
  const d = soloDigitos(e164);
  if (d.length < 4) return "••••";
  return `•••• ••${d.slice(-2)}`;
}

/** Lo que hay guardado de un codigo, para decidir si sirve. */
export type CodigoGuardado = {
  expires_at: string;
  attempts: number;
  consumed_at: string | null;
};

export type VeredictoCodigo =
  | { sirve: true }
  | { sirve: false; motivo: "vencido" | "usado" | "sin_intentos" | "no_existe" };

/**
 * Si un codigo todavia sirve, antes de compararlo.
 *
 * Vive aqui y no dentro de la accion porque es la parte que decide si alguien
 * entra o no: tiene que poder probarse sin base de datos ni WhatsApp.
 */
export function veredictoDelCodigo(
  fila: CodigoGuardado | null | undefined,
  ahora: Date = new Date()
): VeredictoCodigo {
  if (!fila) return { sirve: false, motivo: "no_existe" };
  if (fila.consumed_at) return { sirve: false, motivo: "usado" };
  if (new Date(fila.expires_at).getTime() < ahora.getTime()) return { sirve: false, motivo: "vencido" };
  if (fila.attempts >= INTENTOS_MAXIMOS) return { sirve: false, motivo: "sin_intentos" };
  return { sirve: true };
}

/** Segundos que faltan para poder pedir otro codigo. 0 si ya se puede. */
export function esperaEntreEnvios(ultimoEnvio: string | null | undefined, ahora: Date = new Date()): number {
  if (!ultimoEnvio) return 0;
  const transcurrido = ahora.getTime() - new Date(ultimoEnvio).getTime();
  const falta = SEGUNDOS_ENTRE_ENVIOS * 1000 - transcurrido;
  return falta > 0 ? Math.ceil(falta / 1000) : 0;
}
