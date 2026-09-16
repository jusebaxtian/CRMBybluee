"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aplicarInvitacionRegistro } from "@/lib/billing/pagos-chat";
import { componerTelefono } from "@/lib/auth/telefono";

// nginx forwards the real client IP via X-Forwarded-For (may be a chain of
// "client, proxy1, proxy2" — the first entry is the actual visitor).
async function getClientIp(): Promise<string | null> {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return headerStore.get("x-real-ip");
}

/** Dominio que ve el navegador (detras de nginx request.url es localhost). */
async function origenPublico(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
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
  const { data: nuevoWorkspaceId, error: rpcError } = await supabase.rpc("create_workspace_with_owner", {
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

  // Registro por enlace de pago (soporte ya registro el pago desde el chat):
  // el espacio nace activo con el plan pagado. Ver migracion 0105.
  const invitacion = textoDe(formData, "invitacion");
  if (invitacion && nuevoWorkspaceId) {
    await aplicarInvitacionRegistro(createAdminClient(), invitacion, String(nuevoWorkspaceId));
  }

  // El cliente guarda usuario/contraseña en el navegador y navega al panel.
  return { ok: "entrar", valores: { email } };
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

  return { ok: "entrar", valores: { email } };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Recuperar contraseña: Supabase manda el correo con un enlace que vuelve
 * por /auth/callback?next=/restablecer. La respuesta es la misma exista o no
 * el correo, para no revelar que cuentas hay.
 */
export async function solicitarRecuperacion(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = textoDe(formData, "email").toLowerCase();
  if (!email || !CORREO.test(email)) {
    return { errores: { email: "Revisa el correo: no parece válido." }, valores: { email } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origenPublico()}/auth/callback?next=/restablecer`,
  });
  if (error) {
    console.error("recuperar contraseña:", error.message);
    if (error.message.toLowerCase().includes("rate limit")) {
      return { error: "Ya enviamos un correo hace poco. Revisa tu bandeja o espera unos minutos.", valores: { email } };
    }
  }

  return {
    ok: "Si ese correo tiene una cuenta, te enviamos un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.",
    valores: { email },
  };
}

/** Nueva contraseña desde el enlace del correo (la sesion de recuperacion ya esta activa). */
export async function restablecerContrasena(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  const errores: Record<string, string> = {};
  if (password.length < MIN_CONTRASENA) errores.password = `Mínimo ${MIN_CONTRASENA} caracteres.`;
  if (passwordConfirm !== password) errores.passwordConfirm = "Las contraseñas no coinciden.";
  if (Object.keys(errores).length > 0) return { errores };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "El enlace venció o ya fue usado. Pide uno nuevo." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.message.toLowerCase().includes("different from the old")) {
      return { errores: { password: "Debe ser distinta a la contraseña anterior." } };
    }
    return { error: "No pudimos guardar la contraseña. Intenta de nuevo." };
  }

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
