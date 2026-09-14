"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/auth/with-workspace";
import {
  getBusinessProfile,
  updateBusinessProfile,
  uploadTemplateHeaderExample,
  BUSINESS_VERTICALS,
  type BusinessProfile,
} from "@/lib/whatsapp/graph";

/**
 * Perfil de negocio de cada numero conectado (Configuracion -> WhatsApp API).
 * El token es el de la cuenta; la cuenta debe pertenecer al espacio activo.
 */
type Cuenta = { phone_number_id: string; access_token: string; status: string };

async function cuentaDelEspacio(accountId: string): Promise<{ error: string } | { cuenta: Cuenta }> {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { data: cuenta } = await ctx.supabase
    .from("whatsapp_accounts")
    .select("phone_number_id, access_token, status")
    .eq("id", accountId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!cuenta) return { error: "No se encontró el número." };
  if (cuenta.status === "frozen") return { error: "Este número está congelado." };
  return { cuenta: cuenta as Cuenta };
}

export async function leerPerfilWhatsApp(accountId: string): Promise<{ error: string } | { perfil: BusinessProfile }> {
  const r = await cuentaDelEspacio(accountId);
  if ("error" in r) return { error: r.error };
  try {
    return { perfil: await getBusinessProfile(r.cuenta.phone_number_id, r.cuenta.access_token) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo leer el perfil." };
  }
}

const MAX_FOTO = 5 * 1024 * 1024;

export async function guardarPerfilWhatsApp(formData: FormData): Promise<{ error: string } | { success: true }> {
  const accountId = String(formData.get("accountId") ?? "");
  const r = await cuentaDelEspacio(accountId);
  if ("error" in r) return { error: r.error };

  const texto = (k: string) => String(formData.get(k) ?? "").trim();
  const about = texto("about");
  const description = texto("description");
  const address = texto("address");
  const email = texto("email");
  const vertical = texto("vertical");
  const websites = [texto("website1"), texto("website2")].filter(Boolean);

  if (about.length > 139) return { error: "La descripción corta admite máximo 139 caracteres." };
  if (description.length > 512) return { error: "La información del negocio admite máximo 512 caracteres." };
  if (address.length > 256) return { error: "La dirección admite máximo 256 caracteres." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "Revisa el correo: no parece válido." };
  for (const w of websites) {
    if (!/^https?:\/\/\S+$/i.test(w)) return { error: `El sitio web debe empezar por http:// o https:// (${w}).` };
    if (w.length > 256) return { error: "Cada sitio web admite máximo 256 caracteres." };
  }
  if (vertical && !(BUSINESS_VERTICALS as readonly string[]).includes(vertical)) {
    return { error: "Categoría no válida." };
  }

  // Foto: se sube a Meta con la API de subida (misma que las cabeceras de
  // plantilla) y se referencia por su "handle".
  let profile_picture_handle: string | undefined;
  const foto = formData.get("photo");
  if (foto instanceof File && foto.size > 0) {
    if (!["image/jpeg", "image/png"].includes(foto.type)) return { error: "La foto debe ser JPG o PNG." };
    if (foto.size > MAX_FOTO) return { error: "La foto pesa más de 5 MB." };
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    if (!appId) return { error: "Falta configurar NEXT_PUBLIC_META_APP_ID en el servidor." };
    try {
      profile_picture_handle = await uploadTemplateHeaderExample(
        appId,
        r.cuenta.access_token,
        Buffer.from(await foto.arrayBuffer()),
        foto.type,
        foto.name
      );
    } catch (err) {
      return { error: `No se pudo subir la foto a Meta: ${err instanceof Error ? err.message : "error desconocido"}` };
    }
  }

  try {
    await updateBusinessProfile(r.cuenta.phone_number_id, r.cuenta.access_token, {
      about,
      description,
      address,
      email,
      websites,
      vertical: vertical || undefined,
      ...(profile_picture_handle ? { profile_picture_handle } : {}),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Meta rechazó los cambios." };
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}
