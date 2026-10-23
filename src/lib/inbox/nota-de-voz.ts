/**
 * Piezas puras de la grabacion de notas de voz: el nivel del microfono, el
 * resumen de la onda y el reloj. Aparte del componente para poder probarlas.
 */

/** Nivel minimo que se dibuja: una barra casi plana, no invisible, para que la onda no "desaparezca" en silencio. */
export const NIVEL_MINIMO = 0.08;

/**
 * Nivel de una muestra de audio, de 0 a 1.
 *
 * `bytes` es lo que entrega `AnalyserNode.getByteTimeDomainData`: valores de 0
 * a 255 donde 128 es silencio. Se usa el valor eficaz (RMS), que sigue a la
 * voz mejor que el pico. La voz normal rara vez pasa de 0,25 de RMS, asi que
 * se amplifica para que la onda use todo el alto disponible.
 */
export function nivelDeMuestra(bytes: ArrayLike<number>): number {
  if (bytes.length === 0) return NIVEL_MINIMO;
  let suma = 0;
  for (let i = 0; i < bytes.length; i++) {
    const v = (bytes[i] - 128) / 128;
    suma += v * v;
  }
  const rms = Math.sqrt(suma / bytes.length);
  return Math.min(1, Math.max(NIVEL_MINIMO, rms * 4));
}

/**
 * Reduce todo lo grabado a `n` barras, promediando tramos iguales.
 * Sin datos devuelve barras bajas y parejas, no un error.
 */
export function resumirNiveles(niveles: readonly number[], n: number): number[] {
  if (n <= 0) return [];
  if (niveles.length === 0) return Array(n).fill(0.2);
  return Array.from({ length: n }, (_, i) => {
    const desde = Math.floor((i * niveles.length) / n);
    const hasta = Math.max(desde + 1, Math.floor(((i + 1) * niveles.length) / n));
    const tramo = niveles.slice(desde, hasta);
    return tramo.reduce((s, x) => s + x, 0) / tramo.length;
  });
}

/** Las ultimas `n` barras, con barras bajas a la izquierda mientras todavia no hay suficientes. */
export function ultimasBarras(niveles: readonly number[], n: number): number[] {
  const ultimas = niveles.slice(-n);
  return [...Array(Math.max(0, n - ultimas.length)).fill(NIVEL_MINIMO), ...ultimas];
}

/** "00:07" */
export function formatoDeReloj(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
