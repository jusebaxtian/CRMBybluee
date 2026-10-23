/**
 * Nombre de usuario de WhatsApp (@usuario) que puede traer un aviso de Meta.
 *
 * Meta no tiene fijado en nuestro tipo en que campo llega, asi que se busca en los
 * sitios donde puede venir: el perfil del contacto, el propio contacto y el mensaje.
 * Si no llega, devuelve null y el contacto se guarda exactamente igual que antes.
 */

/** Limpia el valor: sin "@", sin espacios, y rechaza lo que no sea un texto razonable. */
export function normalizarUsuario(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim().replace(/^@+/, "").trim();
  if (!limpio || limpio.length > 64 || /\s/.test(limpio)) return null;
  return limpio;
}

type EntradaDeContacto = { profile?: { username?: unknown }; username?: unknown } | undefined | null;
type EntradaDeMensaje = { username?: unknown } | undefined | null;

export function usuarioDeAviso(contacto: EntradaDeContacto, mensaje: EntradaDeMensaje): string | null {
  return (
    normalizarUsuario(contacto?.profile?.username) ??
    normalizarUsuario(contacto?.username) ??
    normalizarUsuario(mensaje?.username)
  );
}

/** Los que escriben sin numero llegan con un identificador "CO.123..." en vez de digitos. */
export function esContactoSinNumero(waId: string): boolean {
  return !/^\d+$/.test(waId);
}
