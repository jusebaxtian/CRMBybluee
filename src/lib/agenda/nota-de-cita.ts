import { plantillaDeCita } from "@/lib/agenda/plantillas-cita";

/**
 * Nota "Importante" de las citas por Meet de Bybluee: sus reuniones son para
 * conectar la API, y hay que hacerlo desde un computador compartiendo pantalla.
 *
 * Es SOLO para el espacio de Bybluee (decision del 28 oct 2026): el mensaje y las
 * plantillas de cita son los mismos para todos los clientes con Agenda, y a un
 * consultorio no le sirve "conectate desde tu PC y ten tus cuentas a mano". Si
 * otro negocio necesita su propia nota, lo indicado es volverla un ajuste de la
 * Agenda en vez de sumar espacios aqui.
 */
export const ESPACIO_BYBLUEE = "3e4ff27d-50e9-484d-a5cb-e11bd1b5ae5f";

/** Plantilla de Meta con la nota (creada solo en las cuentas de WhatsApp de Bybluee). */
export const PLANTILLA_MEET_CON_NOTA = "confirmacion_cita_meet_v3";

export const NOTA_CITA_BYBLUEE =
  "📌 *Importante:*\n" +
  "• Conéctate desde un computador (PC o portátil), no desde el celular, para que puedas compartirme tu pantalla y te guíe paso a paso.\n" +
  "• Ten a mano el acceso a tus cuentas (Facebook / Meta Business y tu WhatsApp) para hacer toda la configuración durante la reunión.";

/** La nota que lleva la confirmacion de una cita, o null. Solo aplica a citas con reunion de Meet. */
export function notaDeCita(workspaceId: string, conMeet: boolean): string | null {
  return workspaceId === ESPACIO_BYBLUEE && conMeet ? NOTA_CITA_BYBLUEE : null;
}

/**
 * La plantilla a buscar para confirmar la cita. Para Bybluee con Meet se prefiere
 * la que trae la nota; mientras Meta no la apruebe, se usa la de siempre (la
 * eleccion toma la primera APROBADA en este orden).
 */
export function plantillaDeCitaPara(workspaceId: string, conMeet: boolean) {
  const base = plantillaDeCita(conMeet);
  if (workspaceId !== ESPACIO_BYBLUEE || !conMeet) return base;
  return { ...base, name: PLANTILLA_MEET_CON_NOTA, alternativas: [base.name, ...(base.alternativas ?? [])] };
}
