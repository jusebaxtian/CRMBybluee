/**
 * Conexion con Google (OAuth 2.0, flujo de servidor).
 *
 * Los permisos son los minimos: el correo para mostrar con que cuenta se
 * conecto, crear/editar/borrar SOLO en los calendarios de los que el usuario
 * es propietario, y saber si esta libre u ocupado (sin titulos ni detalles).
 * Este archivo no toca la base: se prueba sin montar nada.
 */

export const ALCANCE_EVENTOS = "https://www.googleapis.com/auth/calendar.events.owned";
export const ALCANCE_DISPONIBILIDAD = "https://www.googleapis.com/auth/calendar.events.freebusy";

export const ALCANCES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  ALCANCE_EVENTOS,
  ALCANCE_DISPONIBILIDAD,
];

export function urlDeAutorizacion(args: { clientId: string; redirectUri: string; estado: string }): string {
  const p = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    response_type: "code",
    scope: ALCANCES.join(" "),
    // offline + consent: sin esto Google no entrega el token que renueva el
    // acceso, y la conexion moriria a la hora.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: args.estado,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

/**
 * En la pantalla de Google la persona puede desmarcar permisos. Si falta el
 * de eventos la conexion no sirve para nada: se rechaza con un mensaje claro.
 */
export function faltaPermisoDeEventos(scopeConcedido: string | null | undefined): boolean {
  return !(scopeConcedido ?? "").split(/\s+/).includes(ALCANCE_EVENTOS);
}

export type TokensDeGoogle = {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  expires_in?: number;
};

export async function canjearCodigo(args: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<TokensDeGoogle> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: args.code,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      redirect_uri: args.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!r.ok) throw new Error(`Google rechazó el código (${r.status}).`);
  return (await r.json()) as TokensDeGoogle;
}

export async function correoDeGoogle(accessToken: string): Promise<string | null> {
  const r = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { email?: string };
  return j.email ?? null;
}

/** Le avisa a Google que ya no se usa el acceso (al desconectar). Si falla no pasa nada: el usuario tambien puede quitarlo desde su cuenta. */
export async function revocarToken(token: string): Promise<void> {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined);
}
