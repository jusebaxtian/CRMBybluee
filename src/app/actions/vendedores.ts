"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/admin";
import { porcentajeValido, transicionValida, type EstadoVenta } from "@/lib/vendedores/comision";

/** Vendedores y sus ventas: todo lo hace solo el administrador de la plataforma. */
async function soloAdmin(): Promise<{ error: string } | { userId: string }> {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { userId: user.id } : { error: "No autenticado." };
}

/** El espacio donde atienden los vendedores: el propio del administrador (donde es dueño). */
async function espacioDelAdministrador(userId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.workspace_id as string | undefined) ?? null;
}

/** Crea un usuario nuevo como asesor del espacio del administrador y lo deja como vendedor. */
export async function crearVendedor(_prev: unknown, formData: FormData) {
  const a = await soloAdmin();
  if ("error" in a) return { error: a.error };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const correo = String(formData.get("correo") ?? "").trim().toLowerCase();
  const clave = String(formData.get("clave") ?? "");
  const pct = porcentajeValido(formData.get("pct"));
  if (!nombre) return { error: "Escribe el nombre." };
  if (!correo) return { error: "Escribe el correo." };
  if (clave.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (pct === null) return { error: "El porcentaje va de 0 a 100." };

  const espacio = await espacioDelAdministrador(a.userId);
  if (!espacio) return { error: "No se encontró tu espacio." };

  const admin = createAdminClient();
  const { data: creado, error } = await admin.auth.admin.createUser({
    email: correo,
    password: clave,
    email_confirm: true,
    user_metadata: { full_name: nombre },
  });
  if (error || !creado.user) {
    return { error: /already|registered|existe/i.test(error?.message ?? "") ? "Ese correo ya tiene una cuenta. Si ya es asesor tuyo, conviértelo en vendedor." : (error?.message ?? "No se pudo crear el usuario.") };
  }
  const userId = creado.user.id;

  const { error: errMiembro } = await admin.from("workspace_members").insert({ workspace_id: espacio, user_id: userId, role: "agent" });
  if (errMiembro) {
    await admin.auth.admin.deleteUser(userId);
    return { error: errMiembro.message };
  }
  const { error: errVendedor } = await admin
    .from("vendedores")
    .insert({ user_id: userId, workspace_id: espacio, comision_pct: pct, created_by: a.userId });
  if (errVendedor) return { error: errVendedor.message };

  revalidatePath("/admin/vendedores");
  return { success: true as const };
}

/** Un asesor que ya existe en tu espacio pasa a ser vendedor. */
export async function convertirEnVendedor(userId: string, pctTexto: string) {
  const a = await soloAdmin();
  if ("error" in a) return { error: a.error };
  const pct = porcentajeValido(pctTexto);
  if (pct === null) return { error: "El porcentaje va de 0 a 100." };
  const espacio = await espacioDelAdministrador(a.userId);
  if (!espacio) return { error: "No se encontró tu espacio." };

  const admin = createAdminClient();
  const { data: miembro } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", espacio)
    .eq("user_id", userId)
    .maybeSingle();
  if (miembro?.role !== "agent") return { error: "Solo un asesor de tu espacio puede ser vendedor." };

  const { error } = await admin
    .from("vendedores")
    .upsert({ user_id: userId, workspace_id: espacio, comision_pct: pct, activo: true, created_by: a.userId });
  if (error) return { error: error.message };
  revalidatePath("/admin/vendedores");
  return { success: true as const };
}

/** Cambia el porcentaje (aplica a las ventas NUEVAS) o activa/desactiva al vendedor. */
export async function actualizarVendedor(userId: string, cambios: { pct?: string; activo?: boolean }) {
  const a = await soloAdmin();
  if ("error" in a) return { error: a.error };
  const fila: Record<string, unknown> = {};
  if (cambios.pct !== undefined) {
    const pct = porcentajeValido(cambios.pct);
    if (pct === null) return { error: "El porcentaje va de 0 a 100." };
    fila.comision_pct = pct;
  }
  if (cambios.activo !== undefined) fila.activo = cambios.activo;
  const { error } = await createAdminClient().from("vendedores").update(fila).eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/vendedores");
  return { success: true as const };
}

/** Aprobar (el dinero entro), marcar pagada o anular una venta. */
export async function cambiarEstadoVenta(ventaId: string, hacia: EstadoVenta, nota?: string) {
  const a = await soloAdmin();
  if ("error" in a) return { error: a.error };
  const admin = createAdminClient();
  const { data: venta } = await admin.from("ventas_vendedor").select("estado").eq("id", ventaId).maybeSingle();
  if (!venta) return { error: "Venta no encontrada." };
  const desde = venta.estado as EstadoVenta;
  if (!transicionValida(desde, hacia)) return { error: "Ese cambio no se puede hacer desde el estado actual." };

  const ahora = new Date().toISOString();
  const cambios: Record<string, unknown> = { estado: hacia };
  if (hacia === "aprobada") Object.assign(cambios, { aprobada_at: ahora, aprobada_por: a.userId });
  if (hacia === "pagada") Object.assign(cambios, { pagada_at: ahora, nota_pago: nota?.trim() || null });
  if (hacia === "anulada") Object.assign(cambios, { anulada_at: ahora, motivo_anulacion: nota?.trim() || null });

  // Condicionado al estado leido: dos clics seguidos no aplican el cambio dos veces.
  const { data: hecho, error } = await admin
    .from("ventas_vendedor")
    .update(cambios)
    .eq("id", ventaId)
    .eq("estado", desde)
    .select("id");
  if (error) return { error: error.message };
  if (!hecho?.length) return { error: "La venta cambió mientras tanto. Recarga la página." };

  revalidatePath("/admin/vendedores");
  return { success: true as const };
}
