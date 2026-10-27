/**
 * Piezas puras de la coexistencia (el mismo numero en la app WhatsApp Business
 * y en la API). Lo que toca la base de datos vive en coexistencia-ingest.ts.
 */

/** Dias de historial que se importan. Meta manda hasta 180; el producto usa 30. */
export const DIAS_DE_HISTORIAL = 30;

/**
 * La coexistencia esta disponible para este espacio. Sin la variable
 * COEXISTENCIA_ESPACIOS es para todos; con una lista de ids (separados por
 * coma) solo para esos: sirve para probarla con un numero antes de abrirla.
 */
export function coexistenciaPermitidaPara(espacioId: string | null | undefined): boolean {
  const lista = (process.env.COEXISTENCIA_ESPACIOS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return lista.length === 0 || (!!espacioId && lista.includes(espacioId));
}

type SyncGuardada = {
  contactos?: { estado?: string };
  historial?: { estado?: string; progreso?: number };
} | null;

/** Resumen corto del avance de la sincronizacion inicial, para la tarjeta de la linea. */
export function textoDeSincronizacion(sync: SyncGuardada | undefined): string | null {
  if (!sync) return null;
  const contactos =
    sync.contactos?.estado === "listo"
      ? "Contactos listos"
      : sync.contactos?.estado === "error"
        ? "Contactos con error"
        : "Contactos pendientes";
  const h = sync.historial;
  const historial =
    h?.estado === "listo"
      ? "Historial listo"
      : h?.estado === "rechazado"
        ? "Historial no compartido"
        : h?.estado === "error"
          ? "Historial con error"
          : h?.estado === "en_curso"
            ? `Historial ${Math.max(0, Math.min(99, Math.round(h.progreso ?? 0)))}%`
            : "Historial pendiente";
  return `${contactos} · ${historial}`;
}

export function soloDigitos(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

/** Si un mensaje con esta marca de tiempo (segundos Unix) cae dentro de los ultimos `dias`. */
export function dentroDeLosUltimosDias(segundos: number | string, ahoraMs: number, dias = DIAS_DE_HISTORIAL): boolean {
  const ms = Number(segundos) * 1000;
  return Number.isFinite(ms) && ms >= ahoraMs - dias * 86_400_000 && ms <= ahoraMs + 86_400_000;
}

/** "out" si el mensaje lo envio el negocio (desde su propio numero), "in" si lo envio la persona. */
export function direccionDelHistorial(from: string | undefined, numeroDelNegocio: string | undefined): "in" | "out" {
  return soloDigitos(from) !== "" && soloDigitos(from) === soloDigitos(numeroDelNegocio) ? "out" : "in";
}

/** Estado de entrega que trae el historial, en el vocabulario de la tabla de mensajes. */
export function estadoDelHistorial(status: string | undefined): "sent" | "delivered" | "read" | "failed" {
  switch (status) {
    case "READ":
    case "PLAYED":
      return "read";
    case "DELIVERED":
      return "delivered";
    case "ERROR":
      return "failed";
    default:
      return "sent";
  }
}

export type MensajeDeLaApp = {
  from?: string;
  to?: string;
  id: string;
  timestamp: string | number;
  type: string;
  text?: { body?: string };
  image?: { id?: string; mime_type?: string; caption?: string };
  video?: { id?: string; mime_type?: string; caption?: string };
  audio?: { id?: string; mime_type?: string };
  document?: { id?: string; mime_type?: string; filename?: string; caption?: string };
  sticker?: { id?: string; mime_type?: string };
  edit?: { original_message_id?: string; message?: { text?: { body?: string } } };
  revoke?: { original_message_id?: string };
  history_context?: { status?: string };
};

export type ContenidoDeLaApp = {
  tipo: "text" | "image" | "video" | "audio" | "document" | "sticker";
  texto: string | null;
  /** Id del archivo en Meta, cuando llega (los ecos lo traen; el historial casi nunca). */
  mediaId: string | null;
  mimeType: string | null;
};

/**
 * Lo que se guarda de un mensaje venido de la app del celular. Todo lo que no
 * sea texto o adjunto conocido (ubicacion, contacto, encuesta...) queda como un
 * texto corto que lo dice, para que la conversacion no tenga huecos.
 */
export function contenidoDeLaApp(m: MensajeDeLaApp): ContenidoDeLaApp {
  const adjunto = m.image ?? m.video ?? m.audio ?? m.document ?? m.sticker ?? null;
  if (m.type === "text") return { tipo: "text", texto: m.text?.body ?? null, mediaId: null, mimeType: null };

  if (["image", "video", "audio", "document", "sticker"].includes(m.type)) {
    const leyenda = m.image?.caption ?? m.video?.caption ?? m.document?.caption ?? null;
    return {
      tipo: m.type as ContenidoDeLaApp["tipo"],
      texto: m.type === "document" ? (m.document?.filename ?? leyenda) : leyenda,
      mediaId: adjunto?.id ?? null,
      mimeType: adjunto?.mime_type ?? null,
    };
  }

  if (m.type === "media_placeholder") {
    return { tipo: "text", texto: "📎 Archivo del historial (no disponible)", mediaId: null, mimeType: null };
  }
  return { tipo: "text", texto: `📱 Mensaje enviado desde el celular (${m.type})`, mediaId: null, mimeType: null };
}
