/**
 * Quien emite el soporte. Un solo sitio para cambiarlo.
 *
 * Falta el documento fiscal (NIT o cedula): al 6 oct 2026 solo se dieron el
 * nombre, el correo y el pais, y no se inventa lo demas. Cuando exista, se
 * agrega aqui como `documento: "NIT 900.000.000-0"` y el soporte lo muestra
 * solo, bajo el nombre.
 */
export const EMISOR: { nombre: string; correo: string; pais: string; documento?: string } = {
  nombre: "Digital Bybluee CRM",
  correo: "byblueecom@gmail.com",
  pais: "Colombia",
};

/**
 * Que se le cobra al cliente, en palabras. La tabla de pagos no guarda a que
 * plan correspondia cada pago ni por cuanto tiempo, asi que el concepto es
 * generico: decir "Plan Pro, 1 mes" seria adivinar.
 */
export const CONCEPTO_DEL_PAGO = "Licencia de uso del CRM Bybluee";
