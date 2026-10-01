/**
 * Los bloques del lienzo de Flujos (fase 1).
 *
 * Un solo lugar define que bloques existen, como se ven y que salidas tiene
 * cada uno. El lienzo, el panel lateral y --cuando llegue-- el motor leen de
 * aqui: si un bloque gana una salida, se agrega una vez y los tres se enteran.
 */

export type TipoBloque =
  | "inicio"
  | "mensaje"
  | "plantilla"
  | "botones"
  | "esperar"
  | "condicion"
  | "etiqueta"
  | "agente"
  | "respuesta_rapida"
  | "automatizacion"
  | "saltar"
  | "ia"
  | "fin";

/** Una salida es un punto del que sale una linea hacia el siguiente bloque. */
export type Salida = { id: string; etiqueta: string };

export type DefinicionBloque = {
  tipo: TipoBloque;
  nombre: string;
  descripcion: string;
  /** Color del borde y del icono, del sistema de diseño. */
  color: string;
  /** Cuantos de estos puede haber en un flujo. null = sin limite. */
  maximo: number | null;
  /** Si recibe conexiones entrantes (el inicio no). */
  aceptaEntrada: boolean;
  salidasFijas: Salida[] | null;
};

/** Maximo de botones por mensaje: es limite de WhatsApp, no nuestro. */
export const MAX_BOTONES = 3;

export const BLOQUES: Record<TipoBloque, DefinicionBloque> = {
  inicio: {
    tipo: "inicio",
    nombre: "Inicio",
    descripcion: "Por aquí entra el contacto al flujo",
    color: "var(--primary)",
    maximo: 1,
    aceptaEntrada: false,
    salidasFijas: [{ id: "sig", etiqueta: "" }],
  },
  mensaje: {
    tipo: "mensaje",
    nombre: "Mensaje",
    descripcion: "Texto o archivo, sin esperar respuesta",
    color: "var(--info)",
    maximo: null,
    aceptaEntrada: true,
    salidasFijas: [{ id: "sig", etiqueta: "" }],
  },
  botones: {
    tipo: "botones",
    nombre: "Mensaje con botones",
    descripcion: "Hasta 3 botones; cada uno sigue su propio camino",
    color: "var(--accent-purple)",
    maximo: null,
    aceptaEntrada: true,
    // Las salidas dependen de cuantos botones tenga: se calculan aparte.
    salidasFijas: null,
  },
  esperar: {
    tipo: "esperar",
    nombre: "Esperar respuesta",
    descripcion: "Con tiempo límite: un camino si responde y otro si no",
    color: "var(--warning)",
    maximo: null,
    aceptaEntrada: true,
    salidasFijas: [
      { id: "respondio", etiqueta: "Respondió" },
      { id: "no_respondio", etiqueta: "No respondió" },
    ],
  },
  plantilla: {
    tipo: "plantilla",
    nombre: "Enviar plantilla",
    descripcion: "La única forma de escribir pasadas las 24 horas",
    color: "var(--info)",
    maximo: null,
    aceptaEntrada: true,
    salidasFijas: [{ id: "sig", etiqueta: "" }],
  },
  condicion: {
    tipo: "condicion",
    nombre: "Condición",
    descripcion: "Se parte en dos según la etiqueta del contacto",
    color: "var(--accent-purple)",
    maximo: null,
    aceptaEntrada: true,
    salidasFijas: [
      { id: "si", etiqueta: "Sí cumple" },
      { id: "no", etiqueta: "No cumple" },
    ],
  },
  etiqueta: {
    tipo: "etiqueta",
    nombre: "Poner o quitar etiqueta",
    descripcion: "Marca al contacto y sigue de largo",
    color: "var(--warning)",
    maximo: null,
    aceptaEntrada: true,
    salidasFijas: [{ id: "sig", etiqueta: "" }],
  },
  agente: {
    tipo: "agente",
    nombre: "Asignar a un agente",
    descripcion: "Le entrega el chat a alguien del equipo",
    color: "var(--success)",
    maximo: null,
    aceptaEntrada: true,
    salidasFijas: [{ id: "sig", etiqueta: "" }],
  },
  respuesta_rapida: {
    tipo: "respuesta_rapida",
    nombre: "Respuesta rápida",
    descripcion: "Manda una de las que ya tienes armadas",
    color: "var(--info)",
    maximo: null,
    aceptaEntrada: true,
    salidasFijas: [{ id: "sig", etiqueta: "" }],
  },
  automatizacion: {
    tipo: "automatizacion",
    nombre: "Disparar automatización",
    descripcion: "Corre una automatización ya creada y sigue",
    color: "var(--accent-purple)",
    maximo: null,
    aceptaEntrada: true,
    salidasFijas: [{ id: "sig", etiqueta: "" }],
  },
  saltar: {
    tipo: "saltar",
    nombre: "Saltar a otro flujo",
    descripcion: "Termina este y mete al contacto en otro",
    color: "var(--muted)",
    maximo: null,
    aceptaEntrada: true,
    salidasFijas: null,
  },
  ia: {
    tipo: "ia",
    nombre: "Entregar a la IA",
    descripcion: "Termina el flujo y el agente sigue la conversación",
    color: "var(--success)",
    maximo: null,
    aceptaEntrada: true,
    salidasFijas: null,
  },
  fin: {
    tipo: "fin",
    nombre: "Fin",
    descripcion: "El contacto sale del flujo y vuelve a lo normal",
    color: "var(--muted)",
    maximo: null,
    aceptaEntrada: true,
    salidasFijas: null,
  },
};

/** Lo que el usuario puede arrastrar al lienzo (el inicio ya viene puesto). */
export const BLOQUES_ARRASTRABLES: TipoBloque[] = [
  "mensaje",
  "plantilla",
  "botones",
  "esperar",
  "condicion",
  "etiqueta",
  "agente",
  "respuesta_rapida",
  "automatizacion",
  "saltar",
  "ia",
  "fin",
];

/** Como entra un contacto al flujo. Son los mismos de las automatizaciones. */
export type TipoDisparador =
  | "keyword"
  | "button_tap"
  | "any_message"
  | "first_message_of_day"
  | "tag"
  | "manual";

export type Disparador = {
  tipo: TipoDisparador;
  /** Palabra clave, cuando el tipo es "keyword". */
  valor?: string;
  /** Etiqueta, cuando el tipo es "tag". */
  tagId?: string;
};

export const DISPARADORES: { tipo: TipoDisparador; nombre: string; ayuda: string; pideValor: boolean }[] = [
  {
    tipo: "keyword",
    nombre: "Escribe una palabra clave",
    ayuda: 'Entra cuando el contacto escribe algo que contiene esa palabra (ej. "precio").',
    pideValor: true,
  },
  {
    tipo: "button_tap",
    nombre: "Toca un botón",
    ayuda:
      'Entra cuando el contacto toca ese botón de una plantilla o de un mensaje con botones. Escribe el texto del botón tal como lo ve, por ejemplo "Si, Quiero Conocer".',
    pideValor: true,
  },
  {
    tipo: "any_message",
    nombre: "Escribe cualquier mensaje",
    ayuda: "Entra con cualquier mensaje que mande, escriba lo que escriba.",
    pideValor: false,
  },
  {
    tipo: "first_message_of_day",
    nombre: "Su primer mensaje del día",
    ayuda: "Entra solo con el primer mensaje que manda cada día, no con los siguientes.",
    pideValor: false,
  },
  {
    tipo: "tag",
    nombre: "Le ponen una etiqueta",
    ayuda: "Entra en el momento en que el contacto recibe esa etiqueta.",
    pideValor: false,
  },
  {
    tipo: "manual",
    nombre: "Un agente lo mete a mano",
    ayuda: "No entra solo: alguien del equipo lo mete al flujo desde el chat.",
    pideValor: false,
  },
];

export type DatosBloque = {
  /** inicio: uno o varios disparadores */
  disparadores?: Disparador[];
  /** mensaje / botones */
  texto?: string;
  /** botones: los titulos que ve el cliente */
  botones?: string[];
  /** esperar */
  minutos?: number;
  /** ia: objetivo propio de este flujo; vacio = usa el agente de la linea */
  objetivo?: string;
  nombreAgente?: string;
  /** plantilla */
  plantillaId?: string;
  plantillaNombre?: string;
  /** condicion: hoy solo por etiqueta, que es lo que el cliente ya entiende */
  condicionTagId?: string;
  condicionTagNombre?: string;
  /** etiqueta */
  etiquetaId?: string;
  etiquetaNombre?: string;
  etiquetaAccion?: "poner" | "quitar";
  /** agente */
  agenteId?: string;
  agenteNombre?: string;
  /** respuesta_rapida */
  respuestaRapidaId?: string;
  respuestaRapidaNombre?: string;
  /** automatizacion */
  automatizacionId?: string;
  automatizacionNombre?: string;
  /** saltar */
  flujoDestinoId?: string;
  flujoDestinoNombre?: string;
};

/** Las salidas reales de un bloque, ya contando sus datos. */
export function salidasDe(tipo: TipoBloque, datos: DatosBloque): Salida[] {
  if (tipo === "botones") {
    const botones = (datos.botones ?? []).slice(0, MAX_BOTONES);
    const salidas = botones.map((titulo, i) => ({
      id: String(i),
      etiqueta: titulo.trim() || `Botón ${i + 1}`,
    }));
    // Siempre hay una salida para "escribió otra cosa": sin ella, un contacto
    // que no toca ningun boton se queda atascado.
    salidas.push({ id: "otro", etiqueta: "Escribió otra cosa" });
    return salidas;
  }
  return BLOQUES[tipo].salidasFijas ?? [];
}

/** Resumen corto que se ve dentro del bloque en el lienzo. */
export function resumenDe(tipo: TipoBloque, datos: DatosBloque): string {
  if (tipo === "inicio") {
    const d = datos.disparadores ?? [];
    if (d.length === 0) return "Sin disparador: nadie entra todavía";
    return d
      .map((x) => {
        if (x.tipo === "keyword") return `Escribe "${x.valor?.trim() || "…"}"`;
        if (x.tipo === "button_tap") return `Toca "${x.valor?.trim() || "…"}"`;
        return DISPARADORES.find((o) => o.tipo === x.tipo)?.nombre ?? x.tipo;
      })
      .join(" · ");
  }
  if (tipo === "mensaje") return datos.texto?.trim() || "Sin mensaje todavía";
  if (tipo === "botones") {
    const texto = datos.texto?.trim() || "Sin pregunta todavía";
    return texto;
  }
  if (tipo === "esperar") {
    const m = datos.minutos ?? 5;
    return `Espera ${m} ${m === 1 ? "minuto" : "minutos"}`;
  }
  if (tipo === "plantilla") return datos.plantillaNombre || "Sin plantilla elegida";
  if (tipo === "condicion") {
    return datos.condicionTagNombre ? `¿Tiene la etiqueta "${datos.condicionTagNombre}"?` : "Sin condición elegida";
  }
  if (tipo === "etiqueta") {
    if (!datos.etiquetaNombre) return "Sin etiqueta elegida";
    return `${datos.etiquetaAccion === "quitar" ? "Quitar" : "Poner"} "${datos.etiquetaNombre}"`;
  }
  if (tipo === "agente") return datos.agenteNombre ? `Para ${datos.agenteNombre}` : "Reparto automático";
  if (tipo === "respuesta_rapida") return datos.respuestaRapidaNombre || "Sin respuesta rápida elegida";
  if (tipo === "automatizacion") return datos.automatizacionNombre || "Sin automatización elegida";
  if (tipo === "saltar") return datos.flujoDestinoNombre ? `Va a "${datos.flujoDestinoNombre}"` : "Sin flujo elegido";
  if (tipo === "ia") return datos.nombreAgente?.trim() || "El agente de IA toma la conversación";
  return "El contacto sale del flujo";
}
