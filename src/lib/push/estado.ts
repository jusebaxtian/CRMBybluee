/**
 * Estado de las notificaciones del celular/navegador de una persona, y cuando
 * volver a insistirle. Puro (sin navegador) para poder probarlo.
 *
 * Reglas que vienen de los navegadores, no del CRM:
 * - iPhone solo entrega avisos a una app instalada en la pantalla de inicio.
 * - El permiso "bloqueado" no se puede volver a pedir desde la pagina: hay que
 *   cambiarlo a mano en los ajustes del navegador o del telefono.
 */

export type EstadoNotificaciones =
  | "activas"
  | "por-activar"
  | "bloqueadas"
  | "ios-instalar"
  | "no-soportado";

export function calcularEstado(i: {
  /** El navegador sabe de service workers, push y notificaciones. */
  soportado: boolean;
  esIos: boolean;
  /** Abierta desde el icono de la pantalla de inicio. */
  instalada: boolean;
  permiso: "default" | "granted" | "denied" | "unsupported";
  /** Este dispositivo ya tiene su suscripcion guardada. */
  suscrito: boolean;
}): EstadoNotificaciones {
  // En iPhone, fuera de la app instalada ni siquiera existe PushManager: la accion es instalar.
  if (i.esIos && !i.instalada) return "ios-instalar";
  if (!i.soportado || i.permiso === "unsupported") return "no-soportado";
  if (i.permiso === "denied") return "bloqueadas";
  if (i.permiso === "granted" && i.suscrito) return "activas";
  return "por-activar";
}

/** Dias que se espera antes de volver a mostrar el aviso a quien lo cerro. */
export const DIAS_ENTRE_AVISOS = 3;

/** ¿Toca mostrar de nuevo el aviso? `cerradoEl` es la hora (ms) en que la persona lo cerro, o null si nunca. */
export function tocaMostrarAviso(cerradoEl: number | null, ahora: number, dias = DIAS_ENTRE_AVISOS): boolean {
  if (cerradoEl === null || !Number.isFinite(cerradoEl)) return true;
  return ahora - cerradoEl >= dias * 86_400_000;
}

/** Texto del boton visible de la barra superior, segun el estado. */
export function etiquetaDelBoton(estado: EstadoNotificaciones): string {
  switch (estado) {
    case "activas":
      return "Avisos activos";
    case "bloqueadas":
      return "Avisos bloqueados";
    case "ios-instalar":
      return "Instalar app";
    case "no-soportado":
      return "Avisos";
    default:
      return "Activar avisos";
  }
}
