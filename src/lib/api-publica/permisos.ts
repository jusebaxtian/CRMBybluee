/** Permisos de una llave de API: lo que puede hacer, marcado al crearla. */

export const MODULO_API = "api_publica";

export const PERMISOS = [
  { clave: "contactos:leer", titulo: "Leer contactos", detalle: "Consultar y buscar contactos" },
  { clave: "contactos:escribir", titulo: "Crear y editar contactos", detalle: "Crear contactos y actualizar sus datos" },
  { clave: "contactos:eliminar", titulo: "Eliminar contactos", detalle: "Borrar contactos con sus chats (no se puede deshacer)" },
  { clave: "etiquetas:leer", titulo: "Leer etiquetas", detalle: "Listar las etiquetas" },
  { clave: "etiquetas:escribir", titulo: "Gestionar etiquetas", detalle: "Crear etiquetas y ponerlas o quitarlas a contactos" },
  { clave: "conversaciones:leer", titulo: "Leer conversaciones", detalle: "Consultar conversaciones y su historial de mensajes" },
  { clave: "conversaciones:escribir", titulo: "Gestionar conversaciones", detalle: "Cerrar, reabrir y asignar conversaciones a agentes" },
  { clave: "campanas:leer", titulo: "Leer campañas", detalle: "Consultar campañas y sus resultados" },
  { clave: "campanas:escribir", titulo: "Crear y lanzar campañas", detalle: "Crear campañas con plantilla y enviarlas (mensajes masivos)" },
  { clave: "mensajes:enviar", titulo: "Enviar mensajes", detalle: "Enviar texto o plantillas por WhatsApp" },
  { clave: "mensajes:leer", titulo: "Leer mensajes", detalle: "Consultar el estado de los mensajes enviados" },
  { clave: "plantillas:leer", titulo: "Leer plantillas", detalle: "Listar las plantillas aprobadas" },
  { clave: "lineas:leer", titulo: "Leer líneas", detalle: "Listar las líneas de WhatsApp conectadas" },
] as const;

export type Permiso = (typeof PERMISOS)[number]["clave"];

const VALIDOS = new Set<string>(PERMISOS.map((p) => p.clave));

export function esPermiso(valor: string): valor is Permiso {
  return VALIDOS.has(valor);
}

/** Deja solo permisos conocidos, sin repetir. */
export function permisosValidos(entrada: unknown): Permiso[] {
  if (!Array.isArray(entrada)) return [];
  return [...new Set(entrada.filter((p): p is Permiso => typeof p === "string" && esPermiso(p)))];
}
