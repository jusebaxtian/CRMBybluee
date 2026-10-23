import { NextResponse } from "next/server";

/**
 * Formato unico de error de la API:
 *   { "error": { "codigo": "permiso_denegado", "mensaje": "..." } }
 * El codigo es estable (para programas); el mensaje es para personas.
 */
export type CodigoError =
  | "llave_invalida"
  | "llave_vencida"
  | "modulo_no_incluido"
  | "cuenta_bloqueada"
  | "permiso_denegado"
  | "limite_excedido"
  | "peticion_invalida"
  | "no_encontrado"
  | "conflicto"
  | "ventana_cerrada"
  | "sin_linea"
  | "error_whatsapp"
  | "error_interno";

const ESTADO: Record<CodigoError, number> = {
  llave_invalida: 401,
  llave_vencida: 401,
  modulo_no_incluido: 403,
  cuenta_bloqueada: 403,
  permiso_denegado: 403,
  limite_excedido: 429,
  peticion_invalida: 400,
  no_encontrado: 404,
  conflicto: 409,
  ventana_cerrada: 422,
  sin_linea: 422,
  error_whatsapp: 502,
  error_interno: 500,
};

export function error(codigo: CodigoError, mensaje: string, extra?: Record<string, unknown>, cabeceras?: Record<string, string>) {
  return NextResponse.json({ error: { codigo, mensaje, ...extra } }, { status: ESTADO[codigo], headers: cabeceras });
}

export function ok(datos: unknown, estado = 200, cabeceras?: Record<string, string>) {
  return NextResponse.json(datos, { status: estado, headers: cabeceras });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esUuid = (v: string) => UUID.test(v);

/** Pagina y limite de la query, con tope. */
export function paginacion(url: URL, maximo = 100, porDefecto = 50) {
  const limite = Math.min(maximo, Math.max(1, Number(url.searchParams.get("limite")) || porDefecto));
  const pagina = Math.max(1, Number(url.searchParams.get("pagina")) || 1);
  return { limite, pagina, desde: (pagina - 1) * limite };
}

/** Cuerpo JSON de la peticion, o null si no es un objeto JSON valido. */
export async function cuerpoJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const v = await request.json();
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
