"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/admin";
import { createAuthenticationTemplate, sendAuthenticationCode } from "@/lib/whatsapp/graph";
import {
  ENVIOS_POR_HORA,
  INTENTOS_MAXIMOS,
  LARGO_MINIMO_CLAVE,
  MINUTOS_DEL_PERMISO,
  MINUTOS_DE_VIDA,
  SEGUNDOS_ENTRE_ENVIOS,
  coincide,
  generarCodigo,
  generarPermiso,
  hashDe,
  soloDigitos,
  telefonoTapado,
} from "@/lib/auth/recuperacion";

/**
 * Recuperacion de contraseña por WhatsApp, solo para el dueño del espacio.
 *
 * Tres pasos, cada uno su accion: pedir el codigo, verificarlo, y escribir la
 * clave nueva. La clave nunca pasa por el chat — el chat solo trae el codigo.
 */

const COOKIE_PERMISO = "recuperacion_permiso";
const CLAVE_AJUSTE = "recuperacion_whatsapp";

export type RecuperacionState =
  | {
      error?: string;
      errores?: Record<string, string>;
      valores?: Record<string, string>;
      /** Paso alcanzado: el formulario decide que mostrar con esto. */
      paso?: "codigo" | "listo";
      /** "•••• ••67": a donde se mando, sin revelar el numero completo. */
      telefono?: string;
    }
  | undefined;

/** Linea y plantilla con las que la plataforma manda los codigos. */
type AjusteRecuperacion = { whatsappAccountId: string; templateName: string; language: string };

async function ajusteDeRecuperacion(): Promise<AjusteRecuperacion | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", CLAVE_AJUSTE)
    .maybeSingle();
  if (!data?.value) return null;
  try {
    return JSON.parse(data.value) as AjusteRecuperacion;
  } catch {
    return null;
  }
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function textoDe(formData: FormData, campo: string): string {
  return String(formData.get(campo) ?? "").trim();
}

/**
 * Busca al dueño por su correo y devuelve su espacio, si tiene telefono.
 *
 * Devuelve null en todos los casos de "no aplica" sin distinguirlos: correo
 * que no existe, usuario que no es dueño, espacio sin telefono. Quien pide el
 * codigo no ha iniciado sesion, y decirle "ese correo no existe" le regala una
 * lista de clientes a cualquiera que pruebe correos.
 */
async function dueñoPorCorreo(correo: string) {
  const admin = createAdminClient();

  // Supabase no expone "buscar usuario por correo": se pagina el listado.
  // Son ~106 usuarios, asi que una pagina grande alcanza de sobra.
  const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const usuario = lista?.users.find((u) => u.email?.toLowerCase() === correo);
  if (!usuario) return null;

  const { data: miembro } = await admin
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", usuario.id)
    .eq("role", "owner")
    .maybeSingle();
  if (!miembro) return null;

  const { data: espacio } = await admin
    .from("workspaces")
    .select("id, phone_e164, phone")
    .eq("id", miembro.workspace_id)
    .maybeSingle();

  const telefono = espacio?.phone_e164 || (espacio?.phone ? `+${soloDigitos(espacio.phone)}` : null);
  if (!espacio || !telefono) return null;

  return { userId: usuario.id, workspaceId: espacio.id, telefono };
}

/** Paso 1: manda el codigo al WhatsApp del espacio. */
export async function solicitarCodigo(
  _prev: RecuperacionState,
  formData: FormData
): Promise<RecuperacionState> {
  const email = textoDe(formData, "email").toLowerCase();
  if (!email || !CORREO.test(email)) {
    return { errores: { email: "Revisa el correo: no parece válido." }, valores: { email } };
  }

  const dueño = await dueñoPorCorreo(email);
  // Sin cuenta, sin ser dueño o sin telefono: se responde igual que si todo
  // hubiera salido bien. Lo unico que cambia es que no se manda nada.
  if (!dueño) {
    return { paso: "codigo", telefono: "•••• ••••", valores: { email } };
  }

  const admin = createAdminClient();
  const ahora = Date.now();

  // Limites por telefono: uno por minuto y cinco por hora. Sin esto, el
  // formulario sirve para mandarle mensajes a alguien toda la tarde.
  const { data: recientes } = await admin
    .from("password_reset_codes")
    .select("created_at")
    .eq("phone_e164", dueño.telefono)
    .gte("created_at", new Date(ahora - 3_600_000).toISOString())
    .order("created_at", { ascending: false });

  const ultimo = recientes?.[0]?.created_at;
  if (ultimo && ahora - new Date(ultimo).getTime() < SEGUNDOS_ENTRE_ENVIOS * 1000) {
    const faltan = Math.ceil((SEGUNDOS_ENTRE_ENVIOS * 1000 - (ahora - new Date(ultimo).getTime())) / 1000);
    return {
      error: `Acabamos de enviarte un código. Espera ${faltan} segundo${faltan === 1 ? "" : "s"} para pedir otro.`,
      valores: { email },
    };
  }
  if ((recientes?.length ?? 0) >= ENVIOS_POR_HORA) {
    return {
      error: "Pediste demasiados códigos en la última hora. Espera un rato o escríbenos a soporte.",
      valores: { email },
    };
  }

  const ajuste = await ajusteDeRecuperacion();
  if (!ajuste) {
    console.error("recuperacion por whatsapp: falta configurar la línea y la plantilla en /admin/whatsapp");
    return { error: "La recuperación por WhatsApp no está disponible en este momento. Escríbenos a soporte.", valores: { email } };
  }

  const { data: linea } = await admin
    .from("whatsapp_accounts")
    .select("phone_number_id, access_token, status")
    .eq("id", ajuste.whatsappAccountId)
    .maybeSingle();
  if (!linea || linea.status === "frozen") {
    console.error("recuperacion por whatsapp: la línea configurada no está disponible");
    return { error: "La recuperación por WhatsApp no está disponible en este momento. Escríbenos a soporte.", valores: { email } };
  }

  const codigo = generarCodigo();
  const { error: errorInsert } = await admin.from("password_reset_codes").insert({
    workspace_id: dueño.workspaceId,
    user_id: dueño.userId,
    phone_e164: dueño.telefono,
    code_hash: hashDe(codigo),
    expires_at: new Date(ahora + MINUTOS_DE_VIDA * 60_000).toISOString(),
  });
  if (errorInsert) {
    console.error("recuperacion por whatsapp: no se pudo guardar el código:", errorInsert.message);
    return { error: "No pudimos generar el código. Intenta de nuevo.", valores: { email } };
  }

  try {
    await sendAuthenticationCode(
      linea.phone_number_id,
      linea.access_token,
      soloDigitos(dueño.telefono),
      ajuste.templateName,
      ajuste.language,
      codigo
    );
  } catch (err) {
    // El codigo ya quedo guardado: no se borra a proposito, porque el mensaje
    // puede haber salido y fallado despues. Caduca solo en 10 minutos.
    console.error("recuperacion por whatsapp: falló el envío:", err);
    return {
      error: "No pudimos enviar el código a tu WhatsApp. Escríbenos a soporte y te ayudamos.",
      valores: { email },
    };
  }

  return { paso: "codigo", telefono: telefonoTapado(dueño.telefono), valores: { email } };
}

/** Paso 2: verifica el codigo y deja el permiso para escribir la clave nueva. */
export async function verificarCodigo(
  _prev: RecuperacionState,
  formData: FormData
): Promise<RecuperacionState> {
  const email = textoDe(formData, "email").toLowerCase();
  const codigo = soloDigitos(textoDe(formData, "codigo"));
  const valores = { email };

  if (codigo.length !== 6) {
    return { paso: "codigo", errores: { codigo: "El código son 6 dígitos." }, valores };
  }

  const dueño = await dueñoPorCorreo(email);
  if (!dueño) {
    return { paso: "codigo", errores: { codigo: "El código no es correcto o ya venció." }, valores };
  }

  const admin = createAdminClient();
  const { data: fila } = await admin
    .from("password_reset_codes")
    .select("id, code_hash, expires_at, attempts, consumed_at")
    .eq("phone_e164", dueño.telefono)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const vencido = !fila || new Date(fila.expires_at).getTime() < Date.now();
  const quemado = !!fila && fila.attempts >= INTENTOS_MAXIMOS;
  if (vencido || quemado) {
    return {
      paso: "codigo",
      errores: { codigo: "Ese código ya no sirve. Pide uno nuevo." },
      valores,
    };
  }

  if (!coincide(fila.code_hash, codigo)) {
    await admin
      .from("password_reset_codes")
      .update({ attempts: fila.attempts + 1 })
      .eq("id", fila.id);
    const restantes = INTENTOS_MAXIMOS - (fila.attempts + 1);
    return {
      paso: "codigo",
      errores: {
        codigo:
          restantes > 0
            ? `El código no es correcto. Te ${restantes === 1 ? "queda 1 intento" : `quedan ${restantes} intentos`}.`
            : "El código no es correcto y se agotaron los intentos. Pide uno nuevo.",
      },
      valores,
    };
  }

  // Correcto: se consume y se emite el permiso. El permiso va en una cookie
  // httpOnly y no en la URL — una URL se comparte, se copia y queda en el
  // historial del navegador.
  const permiso = generarPermiso();
  await admin
    .from("password_reset_codes")
    .update({
      consumed_at: new Date().toISOString(),
      reset_token_hash: hashDe(permiso),
      reset_token_expires_at: new Date(Date.now() + MINUTOS_DEL_PERMISO * 60_000).toISOString(),
    })
    .eq("id", fila.id);

  const almacen = await cookies();
  almacen.set(COOKIE_PERMISO, permiso, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MINUTOS_DEL_PERMISO * 60,
  });

  return { paso: "listo", valores };
}

/** Paso 3: la contraseña nueva, con el permiso de la cookie. */
export async function cambiarContrasena(
  _prev: RecuperacionState,
  formData: FormData
): Promise<RecuperacionState> {
  const password = String(formData.get("password") ?? "");
  const confirmacion = String(formData.get("confirmacion") ?? "");

  if (password.length < LARGO_MINIMO_CLAVE) {
    return { errores: { password: `La contraseña debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.` } };
  }
  if (password !== confirmacion) {
    return { errores: { confirmacion: "Las dos contraseñas no coinciden." } };
  }

  const almacen = await cookies();
  const permiso = almacen.get(COOKIE_PERMISO)?.value;
  if (!permiso) {
    return { error: "Se venció el tiempo para cambiar la contraseña. Pide un código nuevo." };
  }

  const admin = createAdminClient();
  const { data: fila } = await admin
    .from("password_reset_codes")
    .select("id, user_id, reset_token_expires_at")
    .eq("reset_token_hash", hashDe(permiso))
    .maybeSingle();

  if (!fila || !fila.reset_token_expires_at || new Date(fila.reset_token_expires_at).getTime() < Date.now()) {
    almacen.delete(COOKIE_PERMISO);
    return { error: "Se venció el tiempo para cambiar la contraseña. Pide un código nuevo." };
  }

  const { error } = await admin.auth.admin.updateUserById(fila.user_id, { password });
  if (error) {
    console.error("recuperacion por whatsapp: no se pudo cambiar la clave:", error.message);
    return { error: "No pudimos cambiar la contraseña. Intenta de nuevo." };
  }

  // Un permiso usado no vuelve a servir.
  await admin
    .from("password_reset_codes")
    .update({ reset_token_hash: null, reset_token_expires_at: null })
    .eq("id", fila.id);
  almacen.delete(COOKIE_PERMISO);

  return { paso: "listo" };
}

// ---------------------------------------------------------------------------
// Ajuste de administracion: por que linea y con que plantilla salen los codigos
// ---------------------------------------------------------------------------

/**
 * La linea no se deduce: se elige.
 *
 * El WhatsApp de administracion de la plataforma apunta hoy a la linea de
 * Ventas, que esta en calidad amarilla y con techo de 250 conversaciones
 * diarias. Los codigos salen por Soporte, que esta limpia. Dejarlo como ajuste
 * evita que mañana un cambio de linea obligue a desplegar.
 */
export async function guardarAjusteRecuperacion(input: AjusteRecuperacion) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  if (!input.whatsappAccountId) return { error: "Elige la línea por la que salen los códigos." };
  if (!input.templateName) return { error: "Elige la plantilla de autenticación." };

  const admin = createAdminClient();
  const { error } = await admin.from("platform_settings").upsert(
    {
      key: CLAVE_AJUSTE,
      value: JSON.stringify(input),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) return { error: error.message };

  revalidatePath("/admin/whatsapp");
  return { success: true as const };
}

export async function obtenerAjusteRecuperacion(): Promise<AjusteRecuperacion | null> {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return null;
  return ajusteDeRecuperacion();
}

/**
 * Crea en Meta la plantilla de autenticacion con boton "Copiar codigo".
 *
 * El texto lo fija Meta; aqui solo se pide con el aviso de seguridad y la
 * caducidad de 10 minutos, que es la misma que aplica el codigo en la base.
 */
export async function crearPlantillaDeRecuperacion(whatsappAccountId: string, nombre: string) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  if (!/^[a-z0-9_]+$/.test(nombre)) {
    return { error: "El nombre solo puede tener minúsculas, números y guiones bajos (_)." };
  }

  const admin = createAdminClient();
  const { data: linea } = await admin
    .from("whatsapp_accounts")
    .select("waba_id, access_token")
    .eq("id", whatsappAccountId)
    .maybeSingle();
  if (!linea) return { error: "Línea no encontrada." };

  try {
    await createAuthenticationTemplate(linea.waba_id, linea.access_token, {
      name: nombre,
      language: "es",
      conAvisoDeSeguridad: true,
      minutosDeCaducidad: MINUTOS_DE_VIDA,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }

  revalidatePath("/admin/whatsapp");
  return { success: true as const };
}
