"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { componerTelefono } from "@/lib/auth/telefono";
import { enviarCodigoPorWhatsApp, verificarCodigo, cambiarContrasena, CODIGO_VIGENCIA_MIN } from "@/lib/auth/recuperacion";

// nginx forwards the real client IP via X-Forwarded-For (may be a chain of
// "client, proxy1, proxy2" — the first entry is the actual visitor).
async function getClientIp(): Promise<string | null> {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return headerStore.get("x-real-ip");
}

export type AuthFormState =
  | {
      /** Error general del formulario. */
      error?: string;
      /** Errores por campo, con el `name` del input como clave. */
      errores?: Record<string, string>;
      /** Lo que la persona ya habia escrito, para no vaciar el formulario. */
      valores?: Record<string, string>;
      /** Mensaje de exito (recuperacion de contraseña). */
      ok?: string;
    }
  | undefined;

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_CONTRASENA = 8;

function textoDe(formData: FormData, campo: string): string {
  return String(formData.get(campo) ?? "").trim();
}

/** Mensajes de Supabase que se traducen a algo que el usuario entienda. */
function traducirErrorRegistro(mensaje: string): { campo?: string; texto: string } {
  const m = mensaje.toLowerCase();
  if (m.includes("already registered") || m.includes("already exists") || m.includes("already been registered")) {
    return { campo: "email", texto: "Este correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña." };
  }
  if (m.includes("password")) return { campo: "password", texto: "La contraseña no cumple los requisitos." };
  if (m.includes("email")) return { campo: "email", texto: "Revisa el correo: no parece válido." };
  if (m.includes("rate limit") || m.includes("too many")) {
    return { texto: "Demasiados intentos seguidos. Espera un momento y vuelve a intentar." };
  }
  return { texto: "No pudimos crear tu cuenta. Intenta de nuevo en un momento." };
}

export async function signup(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const fullName = textoDe(formData, "fullName");
  const companyName = textoDe(formData, "companyName");
  const phoneCountry = textoDe(formData, "phoneCountry");
  const phoneLocal = textoDe(formData, "phone");
  const email = textoDe(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  const valores = { fullName, companyName, phoneCountry, phone: phoneLocal, email };
  const errores: Record<string, string> = {};

  if (!fullName) errores.fullName = "Escribe tu nombre completo.";
  if (!companyName) errores.companyName = "Escribe el nombre de tu empresa.";
  if (!phoneCountry) errores.phone = "Elige tu país.";
  const telefono = phoneCountry ? componerTelefono(phoneCountry, phoneLocal) : null;
  if (!phoneLocal) errores.phone = "Escribe tu número de WhatsApp.";
  else if (phoneCountry && !telefono) errores.phone = "Ese número no es válido para el país elegido.";
  if (!email) errores.email = "Escribe tu correo.";
  else if (!CORREO.test(email)) errores.email = "Revisa el correo: no parece válido.";
  if (!password) errores.password = "Crea una contraseña.";
  else if (password.length < MIN_CONTRASENA) errores.password = `Mínimo ${MIN_CONTRASENA} caracteres.`;
  if (!passwordConfirm) errores.passwordConfirm = "Repite la contraseña.";
  else if (password && passwordConfirm !== password) errores.passwordConfirm = "Las contraseñas no coinciden.";

  if (Object.keys(errores).length > 0 || !telefono) return { errores, valores };

  const supabase = await createClient();

  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    // Mismo sitio donde guardan su nombre los agentes (actions/agents.ts):
    // user_metadata.full_name. Asi el admin y el dashboard lo leen igual.
    options: { data: { full_name: fullName } },
  });

  if (signUpError) {
    const t = traducirErrorRegistro(signUpError.message);
    return t.campo ? { errores: { [t.campo]: t.texto }, valores } : { error: t.texto, valores };
  }

  // ENABLE_EMAIL_AUTOCONFIRM is on, so signUp already returns an active session.
  const signupIp = await getClientIp();
  const { error: rpcError } = await supabase.rpc("create_workspace_with_owner", {
    workspace_name: companyName,
    signup_ip: signupIp,
    phone: telefono.digitos,
    phone_country_code: telefono.countryCode,
    phone_e164: telefono.e164,
  });

  if (rpcError) {
    console.error("signup: create_workspace_with_owner:", rpcError.message);
    return { error: "Tu cuenta quedó creada, pero no pudimos crear tu espacio. Escríbenos a soporte.", valores };
  }

  redirect("/dashboard");
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = textoDe(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");

  const errores: Record<string, string> = {};
  if (!email) errores.email = "Escribe tu correo.";
  else if (!CORREO.test(email)) errores.email = "Revisa el correo: no parece válido.";
  if (!password) errores.password = "Escribe tu contraseña.";
  if (Object.keys(errores).length > 0) return { errores, valores: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Correo o contraseña incorrectos.", valores: { email } };
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Recuperar contraseña por WhatsApp (sin correo). Paso 1: el cliente da su
 * correo y recibe un codigo en el WhatsApp de su espacio. La respuesta es la
 * misma exista o no la cuenta, para no revelar que correos hay.
 */
export async function solicitarCodigoRecuperacion(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = textoDe(formData, "email").toLowerCase();
  if (!email || !CORREO.test(email)) {
    return { errores: { email: "Revisa el correo: no parece válido." }, valores: { email } };
  }

  const r = await enviarCodigoPorWhatsApp(email);
  if (!r.ok) {
    if (r.motivo === "demasiados") {
      return { error: "Ya te enviamos varios códigos. Espera 15 minutos y vuelve a intentar.", valores: { email } };
    }
    if (r.motivo === "sin_canal" || r.motivo === "envio") {
      return { error: "No pudimos enviar el código por WhatsApp. Escríbenos a soporte y te ayudamos.", valores: { email } };
    }
    // sin_cuenta / sin_whatsapp: misma pantalla que si hubiera salido, sin pistas.
  }

  return {
    ok: r.ok
      ? `Te enviamos un código de ${CODIGO_VIGENCIA_MIN} minutos al WhatsApp ${r.telefonoEnmascarado}.`
      : `Si ese correo tiene una cuenta con WhatsApp registrado, le enviamos un código de ${CODIGO_VIGENCIA_MIN} minutos.`,
    valores: { email, paso: "codigo" },
  };
}

/** Paso 2: codigo + contraseña nueva. Si todo cuadra, entra directo. */
export async function restablecerConCodigo(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = textoDe(formData, "email").toLowerCase();
  const codigo = textoDe(formData, "codigo").replace(/\D/g, "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
  const valores = { email, paso: "codigo" };

  const errores: Record<string, string> = {};
  if (codigo.length !== 6) errores.codigo = "El código tiene 6 dígitos.";
  if (password.length < MIN_CONTRASENA) errores.password = `Mínimo ${MIN_CONTRASENA} caracteres.`;
  if (passwordConfirm !== password) errores.passwordConfirm = "Las contraseñas no coinciden.";
  if (Object.keys(errores).length > 0) return { errores, valores };

  const v = await verificarCodigo(email, codigo);
  if (!v.ok) {
    const textos = {
      sin_cuenta: "Código incorrecto.",
      sin_codigo: "Ese código ya se usó o no existe. Pide uno nuevo.",
      vencido: "El código venció. Pide uno nuevo.",
      incorrecto: "Código incorrecto. Revisa el mensaje de WhatsApp.",
      bloqueado: "Demasiados intentos con este código. Pide uno nuevo.",
    } as const;
    return { errores: { codigo: textos[v.motivo] }, valores };
  }

  const fallo = await cambiarContrasena(v.userId, password);
  if (fallo) {
    console.error("recuperacion: no se pudo cambiar la contraseña:", fallo);
    return { error: "No pudimos guardar la contraseña. Intenta de nuevo.", valores };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login");
  redirect("/dashboard");
}

/**
 * Segundo paso de quien entra con Google por primera vez: ya tiene usuario
 * pero no espacio. Pide lo mismo que el registro con correo (negocio y
 * WhatsApp) y crea el espacio con la misma funcion, para que ambos caminos
 * dejen los mismos datos.
 */
export async function completarRegistro(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const companyName = textoDe(formData, "companyName");
  const phoneCountry = textoDe(formData, "phoneCountry");
  const phoneLocal = textoDe(formData, "phone");
  const valores = { companyName, phoneCountry, phone: phoneLocal };

  const errores: Record<string, string> = {};
  if (!companyName) errores.companyName = "Escribe el nombre de tu empresa.";
  const telefono = phoneCountry ? componerTelefono(phoneCountry, phoneLocal) : null;
  if (!phoneLocal) errores.phone = "Escribe tu número de WhatsApp.";
  else if (!telefono) errores.phone = "Ese número no es válido para el país elegido.";
  if (Object.keys(errores).length > 0 || !telefono) return { errores, valores };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Si ya tiene espacio (doble envio, o entro aqui por la URL), no se crea otro.
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membership) redirect("/dashboard");

  const signupIp = await getClientIp();
  const { error: rpcError } = await supabase.rpc("create_workspace_with_owner", {
    workspace_name: companyName,
    signup_ip: signupIp,
    phone: telefono.digitos,
    phone_country_code: telefono.countryCode,
    phone_e164: telefono.e164,
  });

  if (rpcError) {
    console.error("completar registro: create_workspace_with_owner:", rpcError.message);
    return { error: "No pudimos crear tu espacio. Intenta de nuevo o escríbenos a soporte.", valores };
  }

  redirect("/dashboard");
}
