import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplateMessage } from "@/lib/whatsapp/graph";

/**
 * Recuperar contraseña por WhatsApp.
 *
 * La plataforma no manda correos, asi que el codigo llega por el WhatsApp con
 * el que el cliente registro su espacio, enviado desde la cuenta de
 * administracion con una plantilla de autenticacion de Meta (categoria
 * AUTHENTICATION: Meta fija el texto, nosotros solo ponemos el codigo).
 *
 * Reglas: codigo de 6 digitos, vence a los 10 minutos, 5 intentos por codigo,
 * maximo 3 codigos por usuario cada 15 minutos. Solo se guarda el hash.
 */

export const CODIGO_VIGENCIA_MIN = 10;
const MAX_INTENTOS = 5;
const MAX_CODIGOS_POR_VENTANA = 3;
const VENTANA_MIN = 15;
export const PLANTILLA_POR_DEFECTO = "codigo_recuperacion";

function hash(codigo: string): string {
  return createHash("sha256").update(codigo).digest("hex");
}

/** "573001234567" -> "•••• 4567": suficiente para reconocer el numero sin revelarlo. */
export function enmascarar(phone: string): string {
  return `•••• ${phone.slice(-4)}`;
}

export type ResultadoEnvio =
  | { ok: true; telefonoEnmascarado: string }
  | { ok: false; motivo: "sin_cuenta" | "sin_whatsapp" | "demasiados" | "sin_canal" | "envio" };

export async function enviarCodigoPorWhatsApp(email: string): Promise<ResultadoEnvio> {
  const admin = createAdminClient();

  const { data: filas } = await admin.rpc("recuperacion_datos_por_correo", { p_email: email });
  const datos = ((filas ?? []) as { user_id: string; phone: string | null }[])[0];
  if (!datos) return { ok: false, motivo: "sin_cuenta" };
  if (!datos.phone) return { ok: false, motivo: "sin_whatsapp" };

  const desde = new Date(Date.now() - VENTANA_MIN * 60_000).toISOString();
  const { count } = await admin
    .from("codigos_recuperacion")
    .select("id", { count: "exact", head: true })
    .eq("user_id", datos.user_id)
    .gte("created_at", desde);
  if ((count ?? 0) >= MAX_CODIGOS_POR_VENTANA) return { ok: false, motivo: "demasiados" };

  const { data: cuenta } = await admin
    .from("platform_whatsapp_account")
    .select("phone_number_id, access_token")
    .maybeSingle();
  if (!cuenta) return { ok: false, motivo: "sin_canal" };

  const { data: ajuste } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", "plantilla_recuperacion")
    .maybeSingle();
  const plantilla = ajuste?.value || PLANTILLA_POR_DEFECTO;

  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expira = new Date(Date.now() + CODIGO_VIGENCIA_MIN * 60_000).toISOString();

  const { error: errorInsert } = await admin.from("codigos_recuperacion").insert({
    user_id: datos.user_id,
    codigo_hash: hash(codigo),
    expira_en: expira,
  });
  if (errorInsert) {
    console.error("recuperacion: no se pudo guardar el codigo:", errorInsert.message);
    return { ok: false, motivo: "envio" };
  }

  try {
    // Las plantillas de autenticacion llevan el codigo dos veces: en el cuerpo
    // y en el boton "Copiar codigo" (sub_type url, indice 0).
    await sendTemplateMessage(cuenta.phone_number_id, cuenta.access_token, datos.phone, plantilla, "es", [codigo], undefined, {
      index: 0,
      value: codigo,
    });
  } catch (err) {
    console.error("recuperacion: fallo el envio por WhatsApp:", err instanceof Error ? err.message : err);
    return { ok: false, motivo: "envio" };
  }

  return { ok: true, telefonoEnmascarado: enmascarar(datos.phone) };
}

export type ResultadoVerificacion =
  | { ok: true; userId: string }
  | { ok: false; motivo: "sin_cuenta" | "sin_codigo" | "vencido" | "incorrecto" | "bloqueado" };

/** Comprueba el codigo mas reciente del usuario; si es correcto lo marca usado. */
export async function verificarCodigo(email: string, codigo: string): Promise<ResultadoVerificacion> {
  const admin = createAdminClient();

  const { data: filas } = await admin.rpc("recuperacion_datos_por_correo", { p_email: email });
  const datos = ((filas ?? []) as { user_id: string }[])[0];
  if (!datos) return { ok: false, motivo: "sin_cuenta" };

  const { data: registro } = await admin
    .from("codigos_recuperacion")
    .select("id, codigo_hash, expira_en, intentos, usado_en")
    .eq("user_id", datos.user_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!registro || registro.usado_en) return { ok: false, motivo: "sin_codigo" };
  if (new Date(registro.expira_en).getTime() < Date.now()) return { ok: false, motivo: "vencido" };
  if (registro.intentos >= MAX_INTENTOS) return { ok: false, motivo: "bloqueado" };

  const esperado = Buffer.from(registro.codigo_hash, "hex");
  const recibido = Buffer.from(hash(codigo.replace(/\D/g, "")), "hex");
  const coincide = esperado.length === recibido.length && timingSafeEqual(esperado, recibido);

  if (!coincide) {
    await admin
      .from("codigos_recuperacion")
      .update({ intentos: registro.intentos + 1 })
      .eq("id", registro.id);
    return { ok: false, motivo: registro.intentos + 1 >= MAX_INTENTOS ? "bloqueado" : "incorrecto" };
  }

  await admin.from("codigos_recuperacion").update({ usado_en: new Date().toISOString() }).eq("id", registro.id);
  return { ok: true, userId: datos.user_id };
}

export async function cambiarContrasena(userId: string, password: string): Promise<string | null> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  return error ? error.message : null;
}
