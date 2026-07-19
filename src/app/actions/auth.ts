"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

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
      error: string;
    }
  | undefined;

export async function signup(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const companyName = String(formData.get("companyName") ?? "").trim();

  if (!email || !password || !companyName) {
    return { error: "Completa todos los campos." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const supabase = await createClient();

  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    return { error: signUpError.message };
  }

  // ENABLE_EMAIL_AUTOCONFIRM is on, so signUp already returns an active session.
  const signupIp = await getClientIp();
  const { error: rpcError } = await supabase.rpc("create_workspace_with_owner", {
    workspace_name: companyName,
    signup_ip: signupIp,
  });

  if (rpcError) {
    return { error: `Cuenta creada, pero no se pudo crear el workspace: ${rpcError.message}` };
  }

  redirect("/dashboard");
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Completa todos los campos." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Correo o contraseña incorrectos." };
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
