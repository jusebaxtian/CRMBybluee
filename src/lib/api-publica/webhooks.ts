import { createHmac, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createAdminClient } from "@/lib/supabase/admin";
import { descifrar } from "@/lib/integraciones/cifrado";

/**
 * Webhooks de salida: el CRM le avisa a una URL del cliente cuando pasa algo.
 *
 * Los eventos los encolan disparadores de la base (migracion 0153); aqui se
 * entregan: firmados, con tiempo maximo y reintentos con espera creciente.
 */

/** Segundos de espera antes de cada reintento; tras el ultimo, el envio se da por fallido. */
export const RETRASOS_S = [30, 120, 600, 3600, 21_600];
export const MAX_INTENTOS = RETRASOS_S.length + 1;
/** Envios fallidos seguidos tras los cuales el webhook se desactiva solo. */
export const FALLOS_PARA_DESACTIVAR = 20;
const TIMEOUT_MS = 10_000;
const LOTE = 40;
const EN_PARALELO = 5;

export function generarSecreto(): string {
  return "whsec_" + randomBytes(24).toString("base64url");
}

/** Firma del aviso: HMAC-SHA256 de "<tiempo>.<cuerpo>" con el secreto del webhook. */
export function firmar(secreto: string, tiempo: number, cuerpo: string): string {
  return createHmac("sha256", secreto).update(`${tiempo}.${cuerpo}`).digest("hex");
}

export function cabeceraDeFirma(secreto: string, tiempo: number, cuerpo: string): string {
  return `t=${tiempo},v1=${firmar(secreto, tiempo, cuerpo)}`;
}

// ---------------------------------------------------------------------------
// Proteccion contra SSRF: el cliente elige la URL, y el servidor es quien la
// llama. Sin esto, alguien podria apuntarla a la red interna o al servicio de
// metadatos de la nube y leer lo que responda.
// ---------------------------------------------------------------------------

export function esIpPrivada(ip: string): boolean {
  const tipo = isIP(ip);
  if (tipo === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (tipo === 6) {
    const v = ip.toLowerCase();
    const mapeada = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapeada) return esIpPrivada(mapeada[1]);
    return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || /^fe[89ab]/.test(v) || v.startsWith("ff");
  }
  return true;
}

/** null si la URL se puede llamar; si no, el motivo. */
export async function motivoDeUrlInsegura(texto: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return "La URL no es válida.";
  }
  if (url.protocol !== "https:") return "La URL debe empezar por https://";
  if (url.username || url.password) return "La URL no puede llevar usuario ni contraseña.";
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return "Esa dirección es interna y no se puede usar.";
  }
  if (isIP(host)) return esIpPrivada(host) ? "Esa dirección es interna y no se puede usar." : null;
  try {
    const direcciones = await lookup(host, { all: true });
    if (direcciones.length === 0) return "No se pudo resolver el dominio de la URL.";
    if (direcciones.some((d) => esIpPrivada(d.address))) return "Esa dirección es interna y no se puede usar.";
  } catch {
    return "No se pudo resolver el dominio de la URL.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Entrega
// ---------------------------------------------------------------------------

export type ResultadoEntrega = { ok: boolean; codigo: number | null; error: string | null };

/** Un POST firmado. No sigue redirecciones ni guarda lo que responda el cliente. */
export async function entregar(
  webhook: { url: string; secreto_cifrado: string },
  envio: { id: string; evento: string; payload: unknown; creado_el: string }
): Promise<ResultadoEntrega> {
  const motivo = await motivoDeUrlInsegura(webhook.url);
  if (motivo) return { ok: false, codigo: null, error: motivo };

  let secreto: string;
  try {
    secreto = descifrar(webhook.secreto_cifrado);
  } catch {
    return { ok: false, codigo: null, error: "No se pudo leer el secreto del webhook." };
  }

  const cuerpo = JSON.stringify({ id: envio.id, evento: envio.evento, creado_el: envio.creado_el, datos: envio.payload });
  const tiempo = Math.floor(Date.now() / 1000);
  try {
    const r = await fetch(webhook.url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Bybluee-Webhooks/1",
        "X-Bybluee-Event": envio.evento,
        "X-Bybluee-Delivery": envio.id,
        "X-Bybluee-Signature": cabeceraDeFirma(secreto, tiempo, cuerpo),
      },
      body: cuerpo,
    });
    if (r.status >= 200 && r.status < 300) return { ok: true, codigo: r.status, error: null };
    if (r.status >= 300 && r.status < 400) return { ok: false, codigo: r.status, error: "Tu servidor respondió con una redirección; responde 2xx directamente." };
    return { ok: false, codigo: r.status, error: `Tu servidor respondió ${r.status}.` };
  } catch (err) {
    const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return { ok: false, codigo: null, error: timeout ? `Tu servidor no respondió en ${TIMEOUT_MS / 1000} s.` : "No se pudo conectar con tu servidor." };
  }
}

/** Cuando toca el siguiente intento, o null si ya se agotaron. */
export function siguienteIntento(intentosHechos: number, ahora: number = Date.now()): Date | null {
  const espera = RETRASOS_S[intentosHechos - 1];
  return espera === undefined ? null : new Date(ahora + espera * 1000);
}

let corriendo = false;
let ultimaLimpieza = 0;

/** Trabajo de fondo: entrega lo pendiente y, una vez por hora, borra lo viejo. */
export async function procesarWebhooks(): Promise<{ entregados: number; fallidos: number } | null> {
  if (corriendo) return null;
  corriendo = true;
  try {
    return await correr();
  } finally {
    corriendo = false;
  }
}

async function correr() {
  const admin = createAdminClient();
  const ahora = new Date();

  const { data: pendientes } = await admin
    .from("api_webhook_envios")
    .select("id, webhook_id, evento, payload, intentos, creado_el")
    .eq("estado", "pendiente")
    .lte("proximo_intento_el", ahora.toISOString())
    .order("proximo_intento_el")
    .limit(LOTE);

  let entregados = 0;
  let fallidos = 0;

  if (pendientes && pendientes.length > 0) {
    // Se reserva el lote: si el proceso se cae a media entrega, no se repite en bucle.
    await admin
      .from("api_webhook_envios")
      .update({ proximo_intento_el: new Date(ahora.getTime() + 90_000).toISOString() })
      .in("id", pendientes.map((p) => p.id));

    const ids = [...new Set(pendientes.map((p) => p.webhook_id as string))];
    const { data: hooks } = await admin.from("api_webhooks").select("id, url, secreto_cifrado, activo, fallos_seguidos").in("id", ids);
    const porId = new Map((hooks ?? []).map((h) => [h.id as string, h]));

    for (let i = 0; i < pendientes.length; i += EN_PARALELO) {
      await Promise.all(
        pendientes.slice(i, i + EN_PARALELO).map(async (envio) => {
          const hook = porId.get(envio.webhook_id as string);
          if (!hook || !hook.activo) {
            await admin.from("api_webhook_envios").update({ estado: "fallido", ultimo_error: "El webhook está desactivado." }).eq("id", envio.id);
            return;
          }
          const r = await entregar(hook, envio);
          const intentos = (envio.intentos as number) + 1;
          if (r.ok) {
            entregados++;
            await admin
              .from("api_webhook_envios")
              .update({ estado: "enviado", intentos, ultimo_codigo: r.codigo, ultimo_error: null, enviado_el: new Date().toISOString() })
              .eq("id", envio.id);
            await admin.from("api_webhooks").update({ fallos_seguidos: 0, ultimo_envio_el: new Date().toISOString() }).eq("id", hook.id);
            return;
          }
          const proximo = siguienteIntento(intentos);
          if (proximo) {
            await admin
              .from("api_webhook_envios")
              .update({ intentos, ultimo_codigo: r.codigo, ultimo_error: r.error, proximo_intento_el: proximo.toISOString() })
              .eq("id", envio.id);
            return;
          }
          fallidos++;
          await admin.from("api_webhook_envios").update({ estado: "fallido", intentos, ultimo_codigo: r.codigo, ultimo_error: r.error }).eq("id", envio.id);
          const fallos = (hook.fallos_seguidos as number) + 1;
          hook.fallos_seguidos = fallos;
          await admin
            .from("api_webhooks")
            .update(
              fallos >= FALLOS_PARA_DESACTIVAR
                ? { fallos_seguidos: fallos, activo: false, desactivado_motivo: `Se desactivó tras ${fallos} avisos fallidos seguidos. Corrige tu servidor y vuelve a activarlo.` }
                : { fallos_seguidos: fallos }
            )
            .eq("id", hook.id);
        })
      );
    }
  }

  if (ahora.getTime() - ultimaLimpieza > 3600_000) {
    ultimaLimpieza = ahora.getTime();
    const hace7 = new Date(ahora.getTime() - 7 * 86_400_000).toISOString();
    const hace30 = new Date(ahora.getTime() - 30 * 86_400_000).toISOString();
    await admin.from("api_webhook_envios").delete().lt("creado_el", hace7).neq("estado", "pendiente");
    await admin.from("api_uso").delete().lt("created_at", hace30);
  }

  if (entregados + fallidos > 0) console.log(`webhooks: ${entregados} entregados, ${fallidos} fallidos`);
  return { entregados, fallidos };
}

