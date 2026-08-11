"use server";

import { createClient } from "@/lib/supabase/server";

export async function changeOwnPassword(_prevState: unknown, formData: FormData) {
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No se encontró tu sesión." };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  return { success: true as const };
}
