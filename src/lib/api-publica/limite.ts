/**
 * Tope de peticiones por minuto: ventana deslizante en memoria, por llave.
 *
 * La API la atiende un solo proceso, asi que la memoria alcanza. Si algun dia
 * hubiera varios, cada uno cuenta aparte y el tope real seria el de uno por
 * proceso; en ese caso habria que moverlo a la base.
 */

const VENTANA_MS = 60_000;
const golpes = new Map<string, number[]>();

export type ResultadoLimite = { permitido: boolean; restantes: number; reintentarEnSeg: number };

export function consumir(clave: string, tope: number, ahora: number = Date.now()): ResultadoLimite {
  const desde = ahora - VENTANA_MS;
  const lista = (golpes.get(clave) ?? []).filter((t) => t > desde);
  if (lista.length >= tope) {
    golpes.set(clave, lista);
    return { permitido: false, restantes: 0, reintentarEnSeg: Math.max(1, Math.ceil((lista[0] + VENTANA_MS - ahora) / 1000)) };
  }
  lista.push(ahora);
  golpes.set(clave, lista);
  return { permitido: true, restantes: tope - lista.length, reintentarEnSeg: 0 };
}

/** Limpia las llaves sin actividad para que el mapa no crezca. */
export function limpiarInactivas(ahora: number = Date.now()) {
  const desde = ahora - VENTANA_MS;
  for (const [clave, lista] of golpes) {
    if (!lista.some((t) => t > desde)) golpes.delete(clave);
  }
}

export function reiniciarLimites() {
  golpes.clear();
}
