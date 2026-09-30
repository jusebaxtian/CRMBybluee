import { BLOQUES, MAX_BOTONES, salidasDe, type DatosBloque, type TipoBloque } from "@/lib/flujos/bloques";

/**
 * Avisos del flujo: lo que esta mal armado y lo que va a fallar en el envio.
 *
 * Vive aparte del lienzo para poder probarlo sin navegador, y porque el mismo
 * repaso lo necesitara el motor antes de activar un flujo: de nada sirve
 * avisar bonito en pantalla si despues se puede activar igual.
 */

export type NodoParaValidar = { id: string; tipo: TipoBloque; datos: DatosBloque };
export type ConexionParaValidar = { origen_id: string; destino_id: string; salida: string | null };

export type Aviso = {
  /** "error" impide activar el flujo; "aviso" solo advierte. */ 
  nivel: "error" | "aviso";
  nodoId: string | null;
  texto: string;
};

export function revisarFlujo(
  nodos: NodoParaValidar[],
  conexiones: ConexionParaValidar[]
): Aviso[] {
  const avisos: Aviso[] = [];

  const inicios = nodos.filter((n) => n.tipo === "inicio");
  if (inicios.length === 0) {
    avisos.push({ nivel: "error", nodoId: null, texto: "El flujo no tiene bloque de inicio." });
  }

  // Bloques sueltos: nadie llega a ellos. Es el error mas comun al armar un
  // flujo arrastrando cosas, y en pantalla no se nota.
  const conDestino = new Set(conexiones.map((c) => c.destino_id));
  for (const nodo of nodos) {
    if (nodo.tipo === "inicio") continue;
    if (!conDestino.has(nodo.id)) {
      avisos.push({
        nivel: "aviso",
        nodoId: nodo.id,
        texto: `"${BLOQUES[nodo.tipo].nombre}" no está conectado: ningún contacto va a llegar ahí.`,
      });
    }
  }

  for (const nodo of nodos) {
    const salidas = salidasDe(nodo.tipo, nodo.datos);
    const usadas = new Set(
      conexiones.filter((c) => c.origen_id === nodo.id).map((c) => c.salida ?? "sig")
    );

    // Salidas sin conectar: ahi el contacto se queda parado.
    for (const salida of salidas) {
      if (!usadas.has(salida.id)) {
        const nombre = salida.etiqueta ? `la salida "${salida.etiqueta}"` : "la salida";
        avisos.push({
          nivel: "aviso",
          nodoId: nodo.id,
          texto: `"${BLOQUES[nodo.tipo].nombre}" tiene ${nombre} sin conectar.`,
        });
      }
    }

    if (nodo.tipo === "mensaje" && !nodo.datos.texto?.trim()) {
      avisos.push({ nivel: "error", nodoId: nodo.id, texto: "Un mensaje quedó vacío." });
    }

    if (nodo.tipo === "botones") {
      const botones = (nodo.datos.botones ?? []).filter((b) => b.trim());
      if (!nodo.datos.texto?.trim()) {
        avisos.push({ nivel: "error", nodoId: nodo.id, texto: "El mensaje con botones no tiene pregunta." });
      }
      if (botones.length === 0) {
        avisos.push({ nivel: "error", nodoId: nodo.id, texto: "El mensaje con botones no tiene ningún botón." });
      }
      if (botones.length > MAX_BOTONES) {
        avisos.push({
          nivel: "error",
          nodoId: nodo.id,
          texto: `WhatsApp solo permite ${MAX_BOTONES} botones por mensaje.`,
        });
      }
      // Limite de Meta: el titulo del boton no puede pasar de 20 caracteres.
      for (const b of botones) {
        if (b.trim().length > 20) {
          avisos.push({
            nivel: "error",
            nodoId: nodo.id,
            texto: `El botón "${b.trim().slice(0, 20)}…" pasa de 20 caracteres, que es el máximo de WhatsApp.`,
          });
        }
      }
    }

    if (nodo.tipo === "esperar") {
      const m = nodo.datos.minutos ?? 0;
      if (m <= 0) {
        avisos.push({ nivel: "error", nodoId: nodo.id, texto: "La espera tiene que ser de al menos 1 minuto." });
      }
    }
  }

  // Un flujo donde nunca se llega a un fin ni a la IA deja contactos dentro
  // hasta que vence el plazo de dias. Se avisa, no se prohibe.
  if (!nodos.some((n) => n.tipo === "fin" || n.tipo === "ia")) {
    avisos.push({
      nivel: "aviso",
      nodoId: null,
      texto: 'El flujo no termina en ningún lado: agrega un bloque "Fin" o "Entregar a la IA".',
    });
  }

  return avisos;
}
