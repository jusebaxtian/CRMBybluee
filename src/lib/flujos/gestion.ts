import { BLOQUES, resumenDe, salidasDe, type DatosBloque, type TipoBloque } from "@/lib/flujos/bloques";

/**
 * Lo que necesita la vista de contactos de un flujo, sin base de datos: como
 * nombrar el bloque donde esta cada contacto y a donde se le puede mover a mano.
 */
type Nodo = { id: string; tipo: TipoBloque; datos: DatosBloque };
type Conexion = { origen_id: string; destino_id: string; salida: string | null };

export type OpcionDeAvance = { destinoId: string; etiqueta: string; porSalida: boolean };

const recortar = (texto: string, largo: number) => {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length > largo ? `${limpio.slice(0, largo)}…` : limpio;
};

export function nombreDeBloque(nodo: Nodo): string {
  return `${BLOQUES[nodo.tipo].nombre}: ${recortar(resumenDe(nodo.tipo, nodo.datos), 60)}`;
}

/**
 * Primero las salidas conectadas del bloque actual, que es "lo que seguia". Despues
 * cualquier otro bloque, porque quien perdio su bloque no tiene salidas y tambien
 * hay que poder moverlo. El inicio no: nadie vuelve a entrar por ahi a mano.
 */
export function opcionesDeAvance(nodoActualId: string | null, nodos: Nodo[], conexiones: Conexion[]): OpcionDeAvance[] {
  const actual = nodos.find((n) => n.id === nodoActualId);
  const opciones: OpcionDeAvance[] = [];
  const usados = new Set<string>();

  if (actual) {
    usados.add(actual.id);
    for (const salida of salidasDe(actual.tipo, actual.datos)) {
      const conexion = conexiones.find((c) => c.origen_id === actual.id && (c.salida ?? "sig") === salida.id);
      const destino = nodos.find((n) => n.id === conexion?.destino_id);
      if (!destino || usados.has(destino.id)) continue;
      usados.add(destino.id);
      opciones.push({
        destinoId: destino.id,
        etiqueta: `${salida.etiqueta ? `${salida.etiqueta} → ` : "Siguiente → "}${nombreDeBloque(destino)}`,
        porSalida: true,
      });
    }
  }

  for (const n of nodos) {
    if (n.tipo === "inicio" || usados.has(n.id)) continue;
    opciones.push({ destinoId: n.id, etiqueta: nombreDeBloque(n), porSalida: false });
  }
  return opciones;
}
