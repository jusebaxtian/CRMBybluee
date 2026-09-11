/**
 * Lo que Meta manda por postMessage durante el alta incrustada.
 *
 * El codigo anterior solo escuchaba el evento `FINISH` y descartaba en
 * silencio todo lo demas. Meta tiene SEIS finales distintos, y el resultado
 * era que un cliente completaba el alta entera y al volver veia un rojo
 * diciendo que la habia cancelado. Paso con un cliente real el 11 de
 * septiembre de 2026: termino el proceso y su espacio quedo sin numero.
 *
 * Fuente: developers.facebook.com/documentation/business-messaging/whatsapp/
 * embedded-signup/implementation
 */

/** Finales que Meta considera exitosos. */
export const EVENTOS_FIN = [
  "FINISH",
  "FINISH_ONLY_WABA",
  "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
  "FINISH_OBO_MIGRATION",
  "FINISH_GRANT_ONLY_API_ACCESS",
] as const;

export type ResultadoAlta =
  | { tipo: "listo"; wabaId: string; phoneNumberId: string; evento: string }
  /** Termino, pero sin numero: FINISH_ONLY_WABA es el caso tipico. */
  | { tipo: "sin-numero"; wabaId: string | null; evento: string }
  | { tipo: "cancelado"; paso: string | null }
  | { tipo: "error-de-meta"; detalle: string | null }
  /** No era un mensaje del alta: ruido de otro iframe. */
  | { tipo: "ignorar" };

/**
 * Interpreta un mensaje del alta.
 *
 * `event.data` llega como cadena JSON, pero se acepta tambien un objeto: es
 * gratis y evita que un cambio de formato vuelva a dejar clientes colgados sin
 * que nadie sepa por que.
 */
export function interpretarMensajeDeAlta(datosCrudos: unknown): ResultadoAlta {
  let mensaje: Record<string, unknown>;

  if (typeof datosCrudos === "string") {
    try {
      mensaje = JSON.parse(datosCrudos);
    } catch {
      return { tipo: "ignorar" };
    }
  } else if (datosCrudos && typeof datosCrudos === "object") {
    mensaje = datosCrudos as Record<string, unknown>;
  } else {
    return { tipo: "ignorar" };
  }

  if (mensaje.type !== "WA_EMBEDDED_SIGNUP") return { tipo: "ignorar" };

  const evento = typeof mensaje.event === "string" ? mensaje.event : "";
  const datos = (mensaje.data ?? {}) as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);

  if (evento === "CANCEL") {
    return { tipo: "cancelado", paso: texto(datos.current_step) };
  }

  if (evento === "ERROR") {
    return { tipo: "error-de-meta", detalle: texto(datos.error_message) ?? texto(datos.error) };
  }

  if ((EVENTOS_FIN as readonly string[]).includes(evento)) {
    const wabaId = texto(datos.waba_id);
    const phoneNumberId = texto(datos.phone_number_id);

    // FINISH_ONLY_WABA termina bien pero sin numero elegido. Sin numero no hay
    // nada que conectar, y decirlo asi ahorra la llamada de soporte.
    if (!wabaId || !phoneNumberId) {
      return { tipo: "sin-numero", wabaId, evento };
    }
    return { tipo: "listo", wabaId, phoneNumberId, evento };
  }

  return { tipo: "ignorar" };
}

/**
 * Solo los dominios de Meta, comparados por dominio completo.
 *
 * Antes era `origin.endsWith("facebook.com")`, que tambien acepta
 * `malicious-facebook.com`. Nadie lo exploto, pero el mensaje trae los
 * identificadores de la cuenta del cliente.
 */
const ORIGENES = ["facebook.com", "www.facebook.com", "web.facebook.com", "business.facebook.com"];

export function esOrigenDeMeta(origen: string): boolean {
  try {
    const host = new URL(origen).hostname;
    return ORIGENES.includes(host);
  } catch {
    return false;
  }
}

/** El mensaje que se le muestra al usuario para cada final. */
export function mensajeDeAlta(resultado: ResultadoAlta): string {
  switch (resultado.tipo) {
    case "sin-numero":
      return "Se creó la cuenta de WhatsApp Business pero no se seleccionó un número. Vuelve a conectar y elige o registra el número que vas a usar.";
    case "cancelado":
      return resultado.paso
        ? `Se cerró la ventana de Meta antes de terminar (paso: ${resultado.paso}).`
        : "Se cerró la ventana de Meta antes de terminar.";
    case "error-de-meta":
      return resultado.detalle
        ? `Meta reportó un error: ${resultado.detalle}`
        : "Meta reportó un error durante la conexión. Inténtalo de nuevo.";
    default:
      return "No se recibió la información de Meta. Vuelve a intentarlo sin cerrar la ventana emergente.";
  }
}
