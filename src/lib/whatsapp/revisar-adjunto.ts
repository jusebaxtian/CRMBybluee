import {
  formatMB,
  maxBytesByMediaKind,
  mediaKindFromMime,
  validateMediaMime,
  validateMediaSize,
  type MediaKind,
} from "@/lib/whatsapp/media-limits";

/**
 * Lo que dice la vista previa de un adjunto ANTES de enviarlo.
 *
 * Son las mismas reglas con las que el servidor rechaza el archivo (los limites
 * reales de WhatsApp, en `media-limits`), pero ahora la persona las ve junto a
 * la vista previa y el boton de enviar se apaga, en vez de enterarse despues de
 * intentar el envio.
 */

/** Largo maximo del texto que acompaña a una imagen, un video o un documento. */
export const LARGO_MAXIMO_DEL_TEXTO = 1024;

export type RevisionDeAdjunto = {
  tipo: MediaKind;
  /** Impide enviar. */
  error: string | null;
  /** Se puede enviar, pero hay algo que saber. */
  aviso: string | null;
  /** WhatsApp no deja texto en los audios. */
  admiteTexto: boolean;
};

export function revisarAdjunto(archivo: { type: string; size: number }, texto: string): RevisionDeAdjunto {
  const tipo = mediaKindFromMime(archivo.type);
  const admiteTexto = tipo !== "audio";
  let error: string | null = null;
  let aviso: string | null = null;

  if (archivo.size === 0) {
    error = "El archivo está vacío.";
  } else {
    error = validateMediaMime(tipo, archivo.type);
    // El video se comprime en el servidor: su peso final solo se conoce despues,
    // asi que aqui no se bloquea, solo se avisa.
    if (!error && tipo !== "video") error = validateMediaSize(tipo, archivo.size);
    if (!error && tipo === "video" && archivo.size > maxBytesByMediaKind.video) {
      aviso = `Pesa ${formatMB(archivo.size)}. Se comprimirá antes de enviarse y puede tardar un poco.`;
    }
  }

  if (!error && admiteTexto && texto.length > LARGO_MAXIMO_DEL_TEXTO) {
    error = `El texto pasa de ${LARGO_MAXIMO_DEL_TEXTO} caracteres (${texto.length}).`;
  }
  return { tipo, error, aviso, admiteTexto };
}

/** "2,4 MB" / "88 KB" */
export function pesoLegible(bytes: number): string {
  const MB = 1024 * 1024;
  if (bytes >= MB) return `${(bytes / MB).toFixed(bytes >= 10 * MB ? 0 : 1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Extension en mayusculas para la ficha del documento, "PDF". */
export function extensionDe(nombre: string): string {
  const ext = nombre.includes(".") ? nombre.split(".").pop()! : "";
  return ext.slice(0, 5).toUpperCase() || "ARCHIVO";
}
