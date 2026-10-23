/**
 * Piezas puras del reproductor de notas de voz del chat.
 */

/** Hash estable de un texto, para que cada audio dibuje siempre la misma onda. */
function semillaDe(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Altura (0 a 1) de cada barra de la onda de un audio.
 *
 * WhatsApp no entrega la forma real de una nota de voz, y calcularla obligaria
 * a descargar y decodificar cada audio solo para dibujarlo. Asi que la onda es
 * una forma "de voz" generada a partir de la direccion del audio: distinta
 * para cada nota, la misma cada vez que se abre, con picos y silencios como una
 * frase. No representa el volumen real; es para reconocer el audio y para
 * tener donde tocar al adelantar.
 */
export function ondaDeAudio(clave: string, barras: number): number[] {
  if (barras <= 0) return [];
  let x = semillaDe(clave) % 233280 || 1;
  const azar = () => (x = (x * 9301 + 49297) % 233280) / 233280;
  const fase = (semillaDe(clave) % 628) / 100;
  const frases = 3 + (semillaDe(clave) % 3);
  const base = Array.from({ length: barras }, (_, i) => {
    const frase = 0.55 + 0.45 * Math.sin((i / barras) * Math.PI * frases + fase);
    return Math.max(0.14, Math.min(1, frase * (0.35 + 0.65 * azar())));
  });
  // Suavizado: sin el, la onda parece ruido y no una voz.
  return base.map((v, i) => (v + (base[i - 1] ?? v) + (base[i + 1] ?? v)) / 3);
}

/** Posicion del puntero sobre la onda, de 0 a 1. */
export function razonDelPuntero(clientX: number, izquierda: number, ancho: number): number {
  if (!(ancho > 0)) return 0;
  return Math.min(1, Math.max(0, (clientX - izquierda) / ancho));
}

/** "0:34" / "1:05". Sin duracion conocida (todavia no cargo) da "0:00". */
export function formatoDeTiempo(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) return "0:00";
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Avance 0..1 de la reproduccion; 0 mientras no se conozca la duracion (los webm sin cabecera la dan infinita). */
export function avanceDeAudio(actual: number, duracion: number): number {
  if (!Number.isFinite(duracion) || duracion <= 0) return 0;
  return Math.min(1, Math.max(0, actual / duracion));
}
