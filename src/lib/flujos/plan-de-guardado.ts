/**
 * Que hacer con cada bloque al guardar el lienzo.
 *
 * Los bloques que siguen en el dibujo conservan su id. Antes se borraban todos y se
 * creaban de nuevo: cada contacto dentro del flujo perdia el bloque donde iba y sus
 * esperas, y se quedaba atascado hasta que el flujo le venciera (8 casos reales al
 * 5 nov 2026). Los ids nuevos del navegador no estan en la base: esos se crean.
 */
export function planDeGuardado<T extends { id: string }>(idsEnLaBase: string[], nodos: T[]) {
  const existentes = new Set(idsEnLaBase);
  const enElDibujo = new Set(nodos.map((n) => n.id));
  return {
    actualizar: nodos.filter((n) => existentes.has(n.id)),
    crear: nodos.filter((n) => !existentes.has(n.id)),
    borrar: idsEnLaBase.filter((id) => !enElDibujo.has(id)),
  };
}
