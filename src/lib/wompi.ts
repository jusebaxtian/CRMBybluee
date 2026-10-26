import crypto from "node:crypto";

/**
 * Wompi (Colombia). Los secretos solo se leen en el servidor.
 *
 * Variables:
 *  - NEXT_PUBLIC_WOMPI_PUBLIC_KEY  pub_test_… / pub_prod_…
 *  - WOMPI_INTEGRITY_SECRET        test_integrity_… / prod_integrity_…
 *  - WOMPI_EVENTS_SECRET           test_events_… / prod_events_…
 *
 * Sandbox o produccion se decide por el prefijo de la llave publica.
 */

export function wompiConfigurado(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY &&
    process.env.WOMPI_INTEGRITY_SECRET &&
    process.env.WOMPI_EVENTS_SECRET
  );
}

export function wompiEsSandbox(): boolean {
  return (process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY ?? "").startsWith("pub_test_");
}

export function wompiApiBase(): string {
  return wompiEsSandbox() ? "https://sandbox.wompi.co/v1" : "https://production.wompi.co/v1";
}

/** SHA256(referencia + monto en centavos + moneda + secreto de integridad). */
export function firmaDeIntegridadWompi(
  referencia: string,
  montoCentavos: number,
  moneda: string,
  secreto: string
): string {
  return crypto.createHash("sha256").update(`${referencia}${montoCentavos}${moneda}${secreto}`).digest("hex");
}

/** Direccion del Web Checkout de Wompi ya firmada. */
export function urlDeCheckoutWompi(opts: {
  referencia: string;
  montoCentavos: number;
  moneda: string;
  urlDeRegreso: string;
}): string {
  const params = new URLSearchParams({
    "public-key": process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY!,
    currency: opts.moneda,
    "amount-in-cents": String(opts.montoCentavos),
    reference: opts.referencia,
    "signature:integrity": firmaDeIntegridadWompi(
      opts.referencia,
      opts.montoCentavos,
      opts.moneda,
      process.env.WOMPI_INTEGRITY_SECRET!
    ),
    "redirect-url": opts.urlDeRegreso,
  });
  return `https://checkout.wompi.co/p/?${params.toString()}`;
}

export type EventoWompi = {
  event: string;
  data: { transaction?: Record<string, unknown> } & Record<string, unknown>;
  timestamp: number;
  signature?: { properties?: string[]; checksum?: string };
};

function valorEnRuta(objeto: unknown, ruta: string): string {
  let actual: unknown = objeto;
  for (const clave of ruta.split(".")) {
    if (actual === null || typeof actual !== "object") return "";
    actual = (actual as Record<string, unknown>)[clave];
  }
  return actual === undefined || actual === null ? "" : String(actual);
}

/**
 * Verifica el aviso de Wompi: SHA256 de los valores de `signature.properties`
 * (en ese orden, leidos de `data`) + timestamp + secreto de eventos, comparado
 * con el checksum que llega en el cuerpo (y en `X-Event-Checksum`).
 */
export function verificarEventoWompi(
  evento: EventoWompi,
  checksumEncabezado: string | null,
  secreto: string
): boolean {
  const propiedades = evento.signature?.properties;
  const checksumRecibido = (evento.signature?.checksum ?? checksumEncabezado ?? "").toLowerCase();
  if (!propiedades?.length || !checksumRecibido || !secreto) return false;
  const concatenado =
    propiedades.map((p) => valorEnRuta(evento.data, p)).join("") + String(evento.timestamp) + secreto;
  const esperado = crypto.createHash("sha256").update(concatenado).digest("hex");
  const a = Buffer.from(esperado);
  const b = Buffer.from(checksumRecibido);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export type TransaccionWompi = {
  id: string;
  status: string; // APPROVED | DECLINED | VOIDED | ERROR | PENDING
  reference: string;
  amount_in_cents: number;
  currency: string;
};

/** Consulta una transaccion a Wompi (la llave publica basta para leerla). */
export async function consultarTransaccionWompi(id: string): Promise<TransaccionWompi | null> {
  if (!/^[\w-]{3,64}$/.test(id)) return null;
  try {
    const res = await fetch(`${wompiApiBase()}/transactions/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: TransaccionWompi };
    return json.data ?? null;
  } catch {
    return null;
  }
}
