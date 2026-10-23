"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/admin";
import { requireWorkspaceRole } from "@/lib/auth/with-workspace";
import { validarDatosLegales } from "@/lib/soporte/documento";

type EntradaLegal = { razonSocial: string; tipo: string; numero: string; direccion: string };

/**
 * Registra los datos legales de la empresa para sus soportes de compra.
 *
 * Se pueden registrar UNA sola vez: despues quedan bloqueados para el cliente.
 * El bloqueo se aplica en tres sitios, y este es el primero:
 *   - aqui, con `.is("datos_legales_el", null)` en el propio UPDATE, de modo que
 *     dos envios a la vez no se pisan: el segundo no encuentra fila y falla;
 *   - en la base, con el disparador de la migracion 0135, que rechaza cualquier
 *     cambio hecho con una sesion de cliente;
 *   - en la pantalla, que deja de mostrar el formulario.
 *
 * Solo el dueño o un administrador del espacio puede registrarlos: un agente no
 * decide a nombre de quien se emiten los soportes. Se escribe con el cliente de
 * servicio porque el disparador no deja pasar al de sesion.
 */
export async function guardarDatosLegales(input: EntradaLegal) {
  const ctx = await requireWorkspaceRole(["owner", "admin"], "Solo el dueño de la cuenta puede registrar estos datos.");
  if ("error" in ctx) return { error: ctx.error };

  const v = validarDatosLegales(input.razonSocial, input.tipo, input.numero, input.direccion);
  if ("error" in v) return { error: v.error };

  const { data, error } = await createAdminClient()
    .from("workspaces")
    .update({
      razon_social: v.razonSocial,
      documento_tipo: v.tipo,
      documento_numero: v.numero,
      direccion: v.direccion,
      datos_legales_el: new Date().toISOString(),
    })
    .eq("id", ctx.workspaceId)
    .is("datos_legales_el", null)
    .select("id");
  if (error) return { error: "No se pudieron guardar los datos. Intenta de nuevo." };
  if (!data || data.length === 0) {
    return { error: "Tus datos legales ya están registrados y no se pueden editar. Si hay un error, escríbenos a soporte." };
  }

  revalidatePath("/dashboard/billing");
  return { success: true as const };
}

/**
 * Corregir los datos legales de un cliente. Solo un administrador de la
 * plataforma: es la salida cuando el cliente se equivoco y los datos ya estan
 * bloqueados. Tambien sirve para cargarlos por el si pide que lo hagas tu.
 */
export async function corregirDatosLegales(workspaceId: string, input: EntradaLegal) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  const v = validarDatosLegales(input.razonSocial, input.tipo, input.numero, input.direccion);
  if ("error" in v) return { error: v.error };

  const admin = createAdminClient();
  const { data: actual } = await admin.from("workspaces").select("datos_legales_el").eq("id", workspaceId).maybeSingle();
  if (!actual) return { error: "Cliente no encontrado." };

  const { error } = await admin
    .from("workspaces")
    .update({
      razon_social: v.razonSocial,
      documento_tipo: v.tipo,
      documento_numero: v.numero,
      direccion: v.direccion,
      datos_legales_el: (actual.datos_legales_el as string | null) ?? new Date().toISOString(),
    })
    .eq("id", workspaceId);
  if (error) return { error: "No se pudieron guardar los datos." };

  revalidatePath(`/admin/workspaces/${workspaceId}`);
  revalidatePath("/dashboard/billing");
  return { success: true as const };
}
