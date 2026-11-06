/**
 * Cuando una respuesta del agente sale como nota de voz. Lo decide esta regla y no
 * el modelo: probado el 5 nov 2026 con gpt-4o-mini, pedirle que marcara el audio con
 * una etiqueta no funciono ni una vez de 28, ni cuando el cliente mandaba un audio.
 */

/** Unos 40 segundos hablados. Lo que se pase de aqui sale escrito. */
export const MAX_CARACTERES_AUDIO = 600;
/** Por debajo de esto escribe: un saludo o un "dale" en audio suena raro. */
const MINIMO_PARA_EXPLICAR = 160;
/** Si el cliente mando audio se le contesta en audio, salvo una respuesta minima. */
const MINIMO_SI_MANDO_AUDIO = 30;

/** Precios, numeros largos y enlaces van por escrito, para no tener que volver a oirlos. */
const SOLO_ESCRITO = /\$|https?:\/\/|www\.|\d[\d.,]{3,}/i;

/** Lo que de verdad se lee en voz alta. null si no queda nada o es demasiado largo. */
export function textoParaVoz(audio: string): string | null {
  const limpio = audio
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_~`#•]/g, "")
    .replace(/\p{Extended_Pictographic}|️|‍/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!limpio || limpio.length > MAX_CARACTERES_AUDIO) return null;
  return limpio;
}

/**
 * Parte la respuesta en lo que se dice y lo que se escribe.
 *
 * Va en audio cuando el cliente mando un audio, o cuando es una explicacion larga y
 * no acaba de mandar otro: asi no todos los mensajes son audios. Las lineas con
 * cifras o enlaces siempre quedan escritas.
 */
export function decidirAudio(
  respuesta: string,
  contexto: { clienteMandoAudio: boolean; audioReciente: boolean; llevaAdjunto?: boolean }
): { audio: string | null; texto: string } {
  const sinAudio = { audio: null, texto: respuesta.trim() };
  // Con un adjunto (medios de pago, un video) el mensaje acompaña al archivo: va escrito.
  if (contexto.llevaAdjunto) return sinAudio;
  if (contexto.audioReciente && !contexto.clienteMandoAudio) return sinAudio;

  const lineas = respuesta.split("\n");
  const hablado = textoParaVoz(lineas.filter((l) => !SOLO_ESCRITO.test(l)).join(" "));
  if (!hablado) return sinAudio;
  if (hablado.length < (contexto.clienteMandoAudio ? MINIMO_SI_MANDO_AUDIO : MINIMO_PARA_EXPLICAR)) return sinAudio;

  return { audio: hablado, texto: lineas.filter((l) => SOLO_ESCRITO.test(l)).join("\n").trim() };
}
