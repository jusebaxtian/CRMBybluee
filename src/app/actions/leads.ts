"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esEtapa } from "@/lib/leads/etapas";

/** Cambia la etapa a mano. La funcion de la base revisa si esta persona puede. */
export async function cambiarEtapaDelLead(contactId: string, etapa: string) {
  if (!esEtapa(etapa)) return { error: "Etapa no válida." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lead_cambiar_etapa", { p_contact: contactId, p_etapa: etapa });
  if (error) return { error: "No se pudo cambiar la etapa." };
  if (!data) return { error: "No puedes cambiar la etapa de este contacto." };
  revalidatePath("/dashboard/inbox", "layout");
  revalidatePath("/admin/leads");
  return { success: true as const };
}
