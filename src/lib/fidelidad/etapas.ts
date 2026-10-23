/**
 * Plan de fidelidad: las etapas del ciclo de un cliente y como se arma cada mensaje.
 *
 * Todo lo de aqui es puro (sin base de datos ni red) para poder probarlo. El
 * trabajo que envia esta en `envio.ts`.
 *
 * Los dias se cuentan en fechas de Bogota (UTC-5, sin horario de verano) y no en
 * periodos de 24 horas: "vence en 7 dias" tiene que significar siete fechas del
 * calendario, no 168 horas desde el momento en que corre el trabajo.
 */

// La categoria es la que Meta APROBO, no la que pedimos: Meta reclasifico a Marketing varias
// plantillas pedidas como Utility, y el freno de calidad se guia por la real.
export type Categoria = "UTILITY" | "MARKETING";

export type Boton = { type: "URL" | "QUICK_REPLY"; text: string; url?: string };

/** A que se cuentan los dias de una etapa. */
export type Ancla = "vencimiento" | "inicio" | "ninguna";

export type Etapa = {
  clave: string;
  plantilla: string;
  titulo: string;
  /** Dias respecto al ancla: -7 es "7 dias antes", 4 es "4 dias despues". null = no depende de la fecha. */
  dia: number | null;
  /** "vencimiento": fin del plan (o del demo). "inicio": dia en que empezo la cuenta. */
  ancla: Ancla;
  /** A quien le sirve: clientes que pagan, cuentas demo sin pago, o ambos. */
  aplica: "normal" | "demo" | "ambos";
  /** Si dos coinciden el mismo dia sale el de menor numero: 1 vencimiento, 2 bienvenida, 3 conexion. */
  prio: number;
  categoria: Categoria;
  /** Valores de ejemplo para {{1}}, {{2}}... al crear la plantilla en Meta. */
  ejemplos: string[];
  /** Texto de la plantilla aprobada en Meta, para guardarlo en el chat tal como lo vio el cliente. */
  cuerpo: string;
  botones: Boton[];
  /** Sale en cuanto corresponde, de dia o de noche: es la respuesta inmediata a algo que el cliente acaba de hacer. */
  sinHorario?: boolean;
};

const RENOVAR = "https://crmbybluee.blue/dashboard/billing";
const INGRESAR = "https://crmbybluee.blue/login";
const CONECTAR = "https://crmbybluee.blue/dashboard/settings";
const EJ_SALUDO = "Carlos (Tienda Angelita)";

const btnRenovar: Boton = { type: "URL", text: "Renovar mi plan", url: RENOVAR };
const btnActivar: Boton = { type: "URL", text: "Activar mi plan", url: RENOVAR };
const btnConectar: Boton = { type: "URL", text: "Conectar mi número", url: CONECTAR };

export const ETAPAS: Etapa[] = [
  {
    clave: "bienvenida",
    plantilla: "fidelidad_bienvenida",
    titulo: "Bienvenida (al activar la cuenta)",
    dia: null,
    ancla: "ninguna",
    aplica: "normal",
    prio: 2,
    categoria: "UTILITY",
    ejemplos: [EJ_SALUDO, "Tienda Angelita", "carlos@tiendaangelita.com"],
    cuerpo: `¡Bienvenido a Bybluee CRM, {{1}}! 🎉

Tu cuenta quedó creada y activa. Estos son los datos con los que te registraste:

🏢 Negocio: {{2}}
📧 Correo de acceso: {{3}}
🔑 Contraseña: la que creaste al registrarte

Ingresa en crmbybluee.blue y conecta tu número de WhatsApp para empezar. ✅

¿Olvidaste tu contraseña? Puedes recuperarla por WhatsApp desde la pantalla de inicio de sesión.`,
    botones: [{ type: "URL", text: "Ingresar", url: INGRESAR }],
  },
  {
    clave: "registro_sin_plan",
    plantilla: "fidelidad_registro_sin_plan",
    titulo: "Se registró por su cuenta y no ha activado plan (inmediato)",
    dia: null,
    ancla: "ninguna",
    aplica: "normal",
    prio: 2,
    categoria: "UTILITY",
    ejemplos: [EJ_SALUDO],
    cuerpo: `¡Hola, {{1}}! 👋 Te damos la bienvenida a Bybluee CRM.

Te acabas de registrar y tu cuenta ya está creada. Solo te hace falta activar un plan para empezar a usarla. ✅

Si tienes cualquier duda, respóndenos por este chat y te ayudamos con gusto.`,
    botones: [{ type: "URL", text: "Quiero conocer los planes", url: RENOVAR }],
    sinHorario: true,
  },
  {
    clave: "demo_bienvenida",
    plantilla: "fidelidad_demo_bienvenida",
    titulo: "Bienvenida al demo",
    dia: null,
    ancla: "ninguna",
    aplica: "demo",
    prio: 2,
    categoria: "MARKETING",
    ejemplos: [EJ_SALUDO, "2", "9 de octubre de 2026"],
    cuerpo: `Hola {{1}}, tu demo de Bybluee CRM está activa por {{2}} días, hasta el {{3}}.

Entra, conecta tu número y pruébalo con tus propios clientes. Si tienes dudas, responde este mensaje.`,
    botones: [{ type: "URL", text: "Ingresar", url: INGRESAR }],
  },
  {
    clave: "conectar_2_dias",
    plantilla: "fidelidad_conectar_2_dias",
    titulo: "2 días después de empezar, sin línea conectada",
    dia: 2,
    ancla: "inicio",
    aplica: "ambos",
    prio: 3,
    categoria: "UTILITY",
    ejemplos: [EJ_SALUDO],
    cuerpo: `Hola {{1}} 👋

Tu plan de Bybluee CRM ya está activo, pero todavía no conectaste tu número de WhatsApp. Sin eso el CRM no puede recibir ni responder mensajes.

Conéctalo en unos 5 minutos desde Configuración. Si algo se te complica, responde este mensaje y te ayudamos.`,
    botones: [btnConectar],
  },
  {
    clave: "conectar_7_dias",
    plantilla: "fidelidad_conectar_7_dias",
    titulo: "7 días después de empezar, sin línea conectada",
    dia: 7,
    ancla: "inicio",
    aplica: "ambos",
    prio: 3,
    categoria: "MARKETING",
    ejemplos: [EJ_SALUDO],
    cuerpo: `Hola {{1}}, llevas 7 días con tu plan activo y sin conectar tu WhatsApp, así que aún no estás usando el CRM.

Si te trabaste, podemos hacer la conexión contigo paso a paso. Responde «AYUDA» y coordinamos.`,
    botones: [btnConectar],
  },
  {
    clave: "demo_termina_manana",
    plantilla: "fidelidad_demo_termina_manana",
    titulo: "1 día antes de que termine el demo",
    dia: -1,
    ancla: "vencimiento",
    aplica: "demo",
    prio: 1,
    categoria: "MARKETING",
    ejemplos: [EJ_SALUDO, "9 de octubre de 2026"],
    cuerpo: `Hola {{1}}, tu demo de Bybluee CRM termina mañana, {{2}}.

Si te sirvió, activa tu plan hoy y no pierdas lo que configuraste.`,
    botones: [btnActivar],
  },
  {
    clave: "demo_termino",
    plantilla: "fidelidad_demo_termino",
    titulo: "1 día después de terminar el demo",
    dia: 1,
    ancla: "vencimiento",
    aplica: "demo",
    prio: 1,
    categoria: "MARKETING",
    ejemplos: [EJ_SALUDO],
    cuerpo: `Hola {{1}}, tu demo de Bybluee CRM terminó y tu cuenta quedó en pausa.

Todo lo que configuraste sigue guardado. Actívala cuando quieras y retomas donde lo dejaste.`,
    botones: [btnActivar],
  },
  {
    clave: "vence_7_dias",
    plantilla: "fidelidad_vence_7_dias",
    titulo: "7 días antes de vencer",
    dia: -7,
    ancla: "vencimiento",
    aplica: "normal",
    prio: 1,
    categoria: "UTILITY",
    ejemplos: [EJ_SALUDO, "13 de octubre de 2026"],
    cuerpo: `Hola {{1}} 👋

Tu plan de Bybluee CRM vence en 7 días, el {{2}}.

Renueva con tiempo para que tus automatizaciones, seguimientos y chats sigan funcionando sin interrupciones. Puedes pagar con tarjeta, PSE o transferencia.`,
    botones: [btnRenovar],
  },
  {
    clave: "vence_2_dias",
    plantilla: "fidelidad_vence_2_dias",
    titulo: "2 días antes de vencer",
    dia: -2,
    ancla: "vencimiento",
    aplica: "normal",
    prio: 1,
    categoria: "UTILITY",
    ejemplos: [EJ_SALUDO, "13 de octubre de 2026"],
    cuerpo: `Hola {{1}}, faltan 2 días para que venza tu plan de Bybluee CRM ({{2}}).

Si no lo renuevas, tu cuenta se bloqueará y tus automatizaciones dejarán de responder a tus clientes.

Renuévalo en un minuto desde Facturación.`,
    botones: [btnRenovar],
  },
  {
    clave: "vence_hoy",
    plantilla: "fidelidad_vence_hoy",
    titulo: "El día que vence",
    dia: 0,
    ancla: "vencimiento",
    aplica: "normal",
    prio: 1,
    categoria: "UTILITY",
    ejemplos: [EJ_SALUDO],
    cuerpo: `Hola {{1}}, hoy vence tu plan de Bybluee CRM.

Renuévalo hoy para no perder el acceso a tu cuenta. Tus contactos, chats y automatizaciones siguen guardados.`,
    botones: [btnRenovar],
  },
  {
    clave: "vencio_ayer",
    plantilla: "fidelidad_vencio_ayer",
    titulo: "1 día después de vencer",
    dia: 1,
    ancla: "vencimiento",
    aplica: "normal",
    prio: 1,
    categoria: "UTILITY",
    ejemplos: [EJ_SALUDO],
    cuerpo: `Hola {{1}}, tu plan de Bybluee CRM venció ayer y tu cuenta quedó bloqueada.

Actívalo ahora y recuperas el acceso al instante: tus contactos, chats y automatizaciones siguen como los dejaste.`,
    botones: [btnActivar],
  },
  {
    clave: "sin_plan_4_dias",
    plantilla: "fidelidad_sin_plan_4_dias",
    titulo: "4 días después de vencer",
    dia: 4,
    ancla: "vencimiento",
    aplica: "normal",
    prio: 1,
    categoria: "MARKETING",
    ejemplos: [EJ_SALUDO],
    cuerpo: `Hola {{1}}, llevas 4 días sin activar tu plan de Bybluee CRM.

Mientras tanto, tus clientes siguen escribiendo y nadie les responde de forma automática. Queremos que vuelvas: reactiva tu plan y todo sigue como lo dejaste.`,
    botones: [btnActivar],
  },
  {
    clave: "sin_plan_7_dias",
    plantilla: "fidelidad_sin_plan_7_dias",
    titulo: "7 días después de vencer",
    dia: 7,
    ancla: "vencimiento",
    aplica: "normal",
    prio: 1,
    categoria: "MARKETING",
    ejemplos: [EJ_SALUDO],
    cuerpo: `Hola {{1}}, llevas 7 días sin activar tu plan de Bybluee CRM.

Todo lo que configuraste sigue guardado, pero está en pausa. ¿Te ayudamos a reactivarlo? Responde este mensaje y lo resolvemos contigo.`,
    botones: [btnActivar],
  },
  {
    clave: "sin_plan_15_dias",
    plantilla: "fidelidad_sin_plan_15_dias",
    titulo: "15 días después de vencer",
    dia: 15,
    ancla: "vencimiento",
    aplica: "normal",
    prio: 1,
    categoria: "MARKETING",
    ejemplos: [EJ_SALUDO],
    cuerpo: `Hola {{1}}, llevas 15 días sin activar tu plan de Bybluee CRM.

Si algo no te funcionó o tuviste alguna duda, cuéntanos y la resolvemos. Reactiva tu plan y retoma donde lo dejaste.`,
    botones: [btnActivar],
  },
  {
    clave: "ultimo_aviso_30_dias",
    plantilla: "fidelidad_ultimo_aviso_30_dias",
    titulo: "30 días después de vencer (último aviso)",
    dia: 30,
    ancla: "vencimiento",
    aplica: "ambos",
    prio: 1,
    categoria: "MARKETING",
    ejemplos: [EJ_SALUDO, "20 de noviembre de 2026"],
    cuerpo: `Hola {{1}}, llevas 30 días sin activar tu plan de Bybluee CRM.

Confirma si vas a volver. Si no tenemos tu respuesta, daremos de baja tu cuenta y eliminaremos tus datos de forma definitiva el {{2}}, a menos que reactives tu plan.`,
    botones: [
      { type: "QUICK_REPLY", text: "Sí, quiero volver" },
      { type: "QUICK_REPLY", text: "No, dar de baja" },
      btnActivar,
    ],
  },
];

/** Dias entre la fecha del aviso y la baja que promete el ultimo aviso. */
export const DIAS_PARA_LA_BAJA = 7;

/** Botones de respuesta del ultimo aviso; el texto es lo que llega en el chat al tocarlos. */
export const RESPUESTA_VOLVER = "Sí, quiero volver";
export const RESPUESTA_BAJA = "No, dar de baja";

/** Hora (Bogota) desde la que sale el envio del dia, y la hora limite. */
export const HORA_DESDE = 9;
export const HORA_HASTA = 18;

/** Etapas que arrancan apagadas: se encienden a mano cuando haya margen en la linea. */
export const ETAPAS_APAGADAS_POR_DEFECTO = ["conectar_7_dias", "vence_2_dias", "sin_plan_4_dias", "sin_plan_7_dias", "sin_plan_15_dias"];

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const OFFSET_BOGOTA_MS = -5 * 3600_000;

/** Fecha del calendario de Bogota, "2026-10-06". */
export function fechaBogota(instante: Date): string {
  return new Date(instante.getTime() + OFFSET_BOGOTA_MS).toISOString().slice(0, 10);
}

export function horaBogota(instante: Date): number {
  return new Date(instante.getTime() + OFFSET_BOGOTA_MS).getUTCHours();
}

function diaNumero(fecha: string): number {
  const [a, m, d] = fecha.split("-").map(Number);
  return Math.round(Date.UTC(a, m - 1, d) / 86_400_000);
}

/** Positivo si `hoy` esta despues de `fin` (ya vencio), negativo si falta. */
export function diasDespuesDe(fin: string, hoy: string): number {
  return diaNumero(hoy) - diaNumero(fin);
}

export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** "13 de octubre de 2026" */
export function fechaLarga(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

/** "Carlos (Tienda Angelita)" si hay nombre de persona; si no, solo el negocio. */
export function saludoDe(persona: string | null | undefined, negocio: string): string {
  const primerNombre = (persona ?? "").trim().split(/\s+/)[0] ?? "";
  const nombreNegocio = negocio.replace(/\s+/g, " ").trim().slice(0, 60);
  return primerNombre ? `${primerNombre} (${nombreNegocio})` : nombreNegocio;
}

export function etapaPorClave(clave: string): Etapa | undefined {
  return ETAPAS.find((e) => e.clave === clave);
}

/** Valores de {{1}}, {{2}}... de cada etapa. */
export function parametrosDe(
  etapa: Etapa,
  datos: {
    saludo: string;
    negocio: string;
    correo: string;
    vencimiento: string | null;
    hoy: string;
    /** Duracion del demo en dias, para la bienvenida al demo. */
    diasDemo?: number | null;
  }
): string[] {
  switch (etapa.clave) {
    case "bienvenida":
      return [datos.saludo, datos.negocio, datos.correo];
    case "demo_bienvenida":
      return [datos.saludo, String(datos.diasDemo ?? ""), fechaLarga(datos.vencimiento ?? datos.hoy)];
    case "vence_7_dias":
    case "vence_2_dias":
    case "demo_termina_manana":
      return [datos.saludo, fechaLarga(datos.vencimiento ?? datos.hoy)];
    case "ultimo_aviso_30_dias":
      return [datos.saludo, fechaLarga(sumarDias(datos.hoy, DIAS_PARA_LA_BAJA))];
    default:
      return [datos.saludo];
  }
}

/** El texto de la plantilla con sus variables ya puestas, como lo ve el cliente. */
export function cuerpoRenderizado(etapa: Etapa, parametros: string[]): string {
  return etapa.cuerpo.replace(/\{\{(\d+)\}\}/g, (_, n) => parametros[Number(n) - 1] ?? "");
}

export type EspacioDelCiclo = {
  /** Estado del espacio: active, past_due, trialing, canceled... */
  estado: string;
  accesoDesactivado: boolean;
  /** Fin del plan (o del demo) en fecha de Bogota, o null si nunca tuvo uno. */
  vencimiento: string | null;
  /** Cuenta demo que todavia no ha pagado nada. */
  esDemo?: boolean;
  /** Duracion del demo en dias, si es demo. */
  diasDemo?: number | null;
  /** Dia (Bogota) en que empezo la cuenta, la primera suscripcion. */
  inicio?: string | null;
  /** ¿Ya conecto alguna linea de WhatsApp? */
  tieneLinea?: boolean;
};

/**
 * Las etapas que le tocan HOY a un espacio (puede coincidir mas de una; el
 * que llama se queda con la de menor `prio`).
 *
 * Es coincidencia exacta de dia, y es a proposito: al encender el plan no se le
 * manda a nadie lo que ya se le paso. Cada cliente recibe solo la siguiente
 * etapa que le falte, no cinco mensajes de golpe por estar atrasado.
 *
 * Con fecha de vencimiento: antes de vencer el espacio tiene que estar activo
 * (un plan vencido no necesita "renueva con tiempo"); despues, tiene que seguir
 * sin plan. Si renovo, su vencimiento cambia y el dia deja de coincidir solo.
 *
 * Un demo sin pago usa sus propias etapas y no las de renovacion: a quien
 * nunca pago no se le dice "renueva". Solo comparte el ultimo aviso.
 *
 * La conexion se cuenta desde que empezo la cuenta y solo sale mientras no haya
 * ninguna linea conectada y la cuenta siga activa.
 */
export function etapasDeHoy(espacio: EspacioDelCiclo, hoy: string): Etapa[] {
  if (espacio.accesoDesactivado) return [];
  const demo = !!espacio.esDemo;
  const salida: Etapa[] = [];

  for (const etapa of ETAPAS) {
    if (etapa.dia === null) continue;
    if (etapa.aplica === "normal" && demo) continue;
    if (etapa.aplica === "demo" && !demo) continue;

    if (etapa.ancla === "inicio") {
      if (!espacio.inicio || espacio.tieneLinea || espacio.estado !== "active") continue;
      if (diasDespuesDe(espacio.inicio, hoy) === etapa.dia) salida.push(etapa);
      continue;
    }

    if (!espacio.vencimiento) continue;
    const dia = diasDespuesDe(espacio.vencimiento, hoy);
    if (dia !== etapa.dia) continue;
    // Un demo de un solo dia no tiene "mañana": el aviso previo no tiene sentido.
    if (etapa.clave === "demo_termina_manana" && (espacio.diasDemo ?? 0) < 2) continue;
    if (dia < 0) {
      if (espacio.estado === "active") salida.push(etapa);
    } else if (dia === 0) {
      if (espacio.estado === "active" || espacio.estado === "past_due") salida.push(etapa);
    } else if (espacio.estado === "past_due") {
      salida.push(etapa);
    }
  }
  return salida;
}

/** Cuantas horas despues de crearse la primera suscripcion sigue siendo "recien activada". */
export const HORAS_DE_BIENVENIDA = 48;

/** Cuantas horas despues de registrarse sigue valiendo el aviso de "te falta activar un plan". */
export const HORAS_PARA_AVISAR_REGISTRO = 24;

/** ¿Puede salir ahora esta etapa? Las inmediatas, siempre; el resto, solo dentro de la ventana. */
export function puedeSalirAhora(etapa: Etapa, instante: Date): boolean {
  return !!etapa.sinHorario || dentroDeLaVentana(instante);
}

/** ¿Esta dentro de la ventana de envio (y no se ha pasado de la hora limite)? */
export function dentroDeLaVentana(instante: Date): boolean {
  const h = horaBogota(instante);
  return h >= HORA_DESDE && h < HORA_HASTA;
}

/**
 * Que hace la calidad de la linea con un mensaje.
 *
 * Meta califica cada linea (GREEN, YELLOW, RED) segun cuanto la bloquean y la
 * reportan. Con la linea en media solo salen los Utility: son avisos de la
 * cuenta que el cliente espera. Con calidad baja no sale nada. Si no se pudo
 * consultar, se trata como media: es mejor frenar Marketing de mas que empujar
 * mensajes con una linea que no se sabe como esta.
 */
export function frenoDeCalidad(calidad: string | null | undefined, categoria: Categoria): string | null {
  const c = (calidad ?? "").toUpperCase();
  if (c === "RED") return "Línea en calidad baja: no se envía nada";
  if (c === "GREEN") return null;
  if (categoria === "MARKETING") return "Línea en calidad media: se frena Marketing";
  return null;
}
