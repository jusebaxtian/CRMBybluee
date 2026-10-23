"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { descifrar } from "@/lib/integraciones/cifrado";
import { revocarToken } from "@/lib/integraciones/google/oauth";
import { requireWorkspaceRole } from "@/lib/auth/with-workspace";
import { asegurarPlantillasDeCita } from "@/lib/agenda/plantillas-cita";

/**
 * Desconecta el Google Calendar de quien lo pide: le avisa a Google que ya no
 * se usa el acceso y borra la conexion. Los eventos ya creados siguen en su
 * calendario; solo se deja de sincronizar.
 */
export async function desconectarGoogleCalendar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const admin = createAdminClient();
  const { data: conexion } = await admin
    .from("integraciones_conexiones")
    .select("id, token_cifrado")
    .eq("user_id", user.id)
    .eq("proveedor", "google_calendar")
    .maybeSingle();
  if (!conexion) return { success: true as const };

  try {
    await revocarToken(descifrar(conexion.token_cifrado));
  } catch {
    // Sin llave o token ilegible: se borra igual, el usuario puede quitar el acceso desde su cuenta de Google.
  }

  const { error } = await admin.from("integraciones_conexiones").delete().eq("id", conexion.id);
  if (error) return { error: "No se pudo desconectar. Intenta de nuevo." };

  revalidatePath("/dashboard/settings");
  return { success: true as const };
}

/**
 * Elige la linea de WhatsApp por la que salen los mensajes de las citas. null
 * vuelve a "la del chat de cada contacto". Solo dueño y administradores.
 * Al elegir una, se aseguran las plantillas de confirmacion en su cuenta de WhatsApp.
 */
export async function guardarLineaDeCitas(whatsappAccountId: string | null) {
  const ctx = await requireWorkspaceRole(["owner", "admin"], "Solo el dueño o un administrador puede cambiar esto.");
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  if (whatsappAccountId) {
    const { data: linea } = await supabase
      .from("whatsapp_accounts")
      .select("id, status")
      .eq("id", whatsappAccountId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!linea || linea.status === "frozen") return { error: "Esa línea no está disponible." };
  }

  const { error } = await supabase
    .from("agenda_ajustes")
    .upsert({ workspace_id: workspaceId, whatsapp_account_id: whatsappAccountId, updated_at: new Date().toISOString() }, { onConflict: "workspace_id" });
  if (error) return { error: "No se pudo guardar. Intenta de nuevo." };

  if (whatsappAccountId) {
    void asegurarPlantillasDeCita(createAdminClient(), workspaceId).catch((err) =>
      console.error("plantillas de cita:", err instanceof Error ? err.message : err)
    );
  }
  revalidatePath("/dashboard/settings");
  return { success: true as const };
}
