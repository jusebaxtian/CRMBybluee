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

/** 24 horas en minutos: la ventana de servicio de WhatsApp. */
export const MINUTOS_VENTANA = 24 * 60;

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

  // Sin disparador el flujo nunca arranca. Es aviso y no error porque se puede
  // guardar a medias mientras se dibuja; el motor si lo exigira para activar.
  for (const inicio of inicios) {
    const disparadores = inicio.datos.disparadores ?? [];
    if (disparadores.length === 0) {
      avisos.push({
        nivel: "aviso",
        nodoId: inicio.id,
        texto: "El inicio no tiene disparador: nadie va a entrar al flujo.",
      });
      continue;
    }
    for (const d of disparadores) {
      if (d.tipo === "keyword" && !d.valor?.trim()) {
        avisos.push({ nivel: "error", nodoId: inicio.id, texto: "Hay un disparador por palabra clave sin palabra." });
      }
      if (d.tipo === "tag" && !d.tagId) {
        avisos.push({ nivel: "error", nodoId: inicio.id, texto: "Hay un disparador por etiqueta sin etiqueta elegida." });
      }
    }
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

      // La regla que mas flujos rotos evita: pasadas 24 horas desde el ultimo
      // mensaje del contacto, WhatsApp solo entrega plantillas aprobadas. Una
      // espera larga seguida de un mensaje normal es un envio que Meta va a
      // rechazar, y en el lienzo no se ve.
      if (m >= MINUTOS_VENTANA) {
        const siguientes = conexiones
          .filter((c) => c.origen_id === nodo.id && c.salida === "no_respondio")
          .map((c) => nodos.find((n) => n.id === c.destino_id))
          .filter(Boolean) as NodoParaValidar[];
        for (const sig of siguientes) {
          if (sig.tipo === "mensaje" || sig.tipo === "botones") {
            avisos.push({
              nivel: "error",
              nodoId: sig.id,
              texto:
                "Después de esperar 24 horas o más solo se puede enviar una plantilla aprobada: cambia este bloque por uno de plantilla.",
            });
          }
        }
      }
    }

    if (nodo.tipo === "plantilla" && !nodo.datos.plantillaId) {
      avisos.push({ nivel: "error", nodoId: nodo.id, texto: "Elige la plantilla que se va a enviar." });
    }

    if (nodo.tipo === "condicion" && !nodo.datos.condicionTagId) {
      avisos.push({ nivel: "error", nodoId: nodo.id, texto: "La condición no tiene etiqueta elegida." });
    }

    if (nodo.tipo === "etiqueta" && !nodo.datos.etiquetaId) {
      avisos.push({ nivel: "error", nodoId: nodo.id, texto: "Elige qué etiqueta poner o quitar." });
    }

    if (nodo.tipo === "respuesta_rapida" && !nodo.datos.respuestaRapidaId) {
      avisos.push({ nivel: "error", nodoId: nodo.id, texto: "Elige la respuesta rápida." });
    }

    if (nodo.tipo === "automatizacion" && !nodo.datos.automatizacionId) {
      avisos.push({ nivel: "error", nodoId: nodo.id, texto: "Elige la automatización que se va a disparar." });
    }

    if (nodo.tipo === "saltar" && !nodo.datos.flujoDestinoId) {
      avisos.push({ nivel: "error", nodoId: nodo.id, texto: "Elige a qué flujo salta el contacto." });
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
