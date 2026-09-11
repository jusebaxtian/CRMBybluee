/**
 * Politica de retencion de datos de CRMBybluee.
 *
 * Los plazos los fijo Sebastian el 11 de septiembre de 2026. Viven aqui, en un
 * solo sitio, para que cambiarlos sea editar un numero y no reescribir codigo.
 *
 * NO ESTA EN VIGOR TODAVIA. Este modulo define la politica; el trabajo de
 * fondo que la aplica se enciende aparte y por espacio. Definir y ejecutar son
 * pasos distintos a proposito: borrar datos de clientes reales no debe
 * activarse por el hecho de desplegar.
 *
 * Pendiente de revision legal: el rol de responsable o encargado frente a los
 * contactos, el plazo de conservacion de `payments` (obligacion contable, hoy
 * se borran en cascada con el espacio) y que hacer con los respaldos
 * nocturnos, que conservan lo borrado hasta que caducan.
 */

export type ReglaRetencion = {
  /** Nombre corto, el que aparece en los registros de borrado. */
  nombre: string;
  meses: number;
  /** Que se elimina, en una linea, para que el registro se entienda solo. */
  descripcion: string;
};

export const POLITICA_RETENCION = {
  mensajes: {
    nombre: "mensajes",
    meses: 24,
    descripcion: "Mensajes de las conversaciones, en ambos sentidos",
  },
  multimedia: {
    nombre: "multimedia",
    meses: 12,
    descripcion: "Fotos, audios y documentos del bucket chat-media",
  },
  contactosInactivos: {
    nombre: "contactos-inactivos",
    meses: 12,
    descripcion: "Contactos dados de alta hace mas de 12 meses y sin mensajes en ese plazo",
  },
  registros: {
    nombre: "registros",
    meses: 6,
    descripcion: "admin_access_logs: quien entro a que espacio y cuando",
  },
} as const satisfies Record<string, ReglaRetencion>;

/**
 * "Inactivo" se mide TAMBIEN contra la fecha de alta del contacto, no solo
 * contra sus mensajes.
 *
 * Un contacto sin ningun mensaje cumple "sin mensajes en los ultimos 12 meses"
 * de forma trivial, aunque se diera de alta ayer. Medido en produccion el 11
 * de septiembre de 2026: la regla escrita solo sobre mensajes marcaba 626
 * contactos, todos con cero mensajes y todos creados en los ultimos 30 dias
 * -- listas importadas a las que aun no se ha escrito. Borrarlas habria sido
 * destruir el trabajo de importacion de un cliente.
 */
export const CONTACTO_INACTIVO_EXIGE_ANTIGUEDAD = true;

/** La fecha de corte de una regla: todo lo anterior es candidato a borrarse. */
export function corteDe(regla: ReglaRetencion, ahora: Date = new Date()): Date {
  const corte = new Date(ahora);
  corte.setMonth(corte.getMonth() - regla.meses);
  return corte;
}
