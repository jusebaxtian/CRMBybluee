"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

function parseCsv(text: string): { name: string; phone: string }[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const nameIdx = header.indexOf("name") !== -1 ? header.indexOf("name") : header.indexOf("nombre");
  const phoneIdx = header.indexOf("phone") !== -1 ? header.indexOf("phone") : header.indexOf("telefono");

  const dataLines = nameIdx === -1 && phoneIdx === -1 ? lines : lines.slice(1);
  const effectiveNameIdx = nameIdx === -1 ? 0 : nameIdx;
  const effectivePhoneIdx = phoneIdx === -1 ? 1 : phoneIdx;

  return dataLines
    .map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      return {
        name: cols[effectiveNameIdx] ?? "",
        phone: (cols[effectivePhoneIdx] ?? "").replace(/[^0-9]/g, ""),
      };
    })
    .filter((row) => row.phone.length >= 8);
}

export async function importContactsCsv(csvText: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return { error: "No se encontraron filas válidas (se esperan columnas name/nombre y phone/telefono)." };
  }

  const { error } = await supabase.from("contacts").upsert(
    rows.map((r) => ({
      workspace_id: workspaceId,
      wa_id: r.phone,
      name: r.name || null,
    })),
    { onConflict: "workspace_id,wa_id", ignoreDuplicates: false }
  );

  if (error) return { error: error.message };

  revalidatePath("/dashboard/contacts");
  return { success: true, count: rows.length };
}

export async function createContact(_prevState: unknown, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").replace(/[^0-9]/g, "");

  if (phone.length < 8) return { error: "Ingresa un número válido con código de país." };

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { error } = await supabase.from("contacts").upsert(
    { workspace_id: workspaceId, wa_id: phone, name: name || null },
    { onConflict: "workspace_id,wa_id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/dashboard/contacts");
  return { success: true };
}

export async function updateContactNotes(contactId: string, notes: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({ notes })
    .eq("id", contactId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/inbox");
  return { success: true };
}

export async function updateContact(contactId: string, name: string, phone: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const cleanPhone = phone.replace(/[^0-9]/g, "");
  if (cleanPhone.length < 8) return { error: "Ingresa un número válido con código de país." };

  const { error } = await supabase
    .from("contacts")
    .update({ name: name.trim() || null, wa_id: cleanPhone })
    .eq("id", contactId)
    .eq("workspace_id", workspaceId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/contacts");
  return { success: true };
}

export async function bulkDeleteContacts(contactIds: string[]) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };
  if (contactIds.length === 0) return { error: "No hay contactos seleccionados." };

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("workspace_id", workspaceId)
    .in("id", contactIds);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/contacts");
  return { success: true };
}

export async function bulkAddTagToContacts(contactIds: string[], tagId: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };
  if (contactIds.length === 0) return { error: "No hay contactos seleccionados." };
  if (!tagId) return { error: "Selecciona una etiqueta." };

  const { error } = await supabase
    .from("contact_tags")
    .upsert(
      contactIds.map((contactId) => ({ contact_id: contactId, tag_id: tagId })),
      { onConflict: "contact_id,tag_id", ignoreDuplicates: true }
    );

  if (error) return { error: error.message };
  revalidatePath("/dashboard/contacts");
  return { success: true };
}
