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
