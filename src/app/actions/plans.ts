"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/admin";

export async function createPlan(_prevState: unknown, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const priceCop = Number(formData.get("price") ?? 0);
  const billingCycle = String(formData.get("billingCycle") ?? "monthly");

  if (!name) return { error: "El nombre es obligatorio." };
  if (!priceCop || priceCop <= 0) return { error: "Ingresa un precio válido." };

  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  const { error } = await supabase.from("plans").insert({
    name,
    price_cents: Math.round(priceCop * 100),
    currency: "COP",
    billing_cycle: billingCycle,
    // Safe defaults — edit right after creating via "Límites del plan".
    // Left null (unlimited) would let a workspace on a brand-new plan
    // connect unlimited agents/numbers until someone notices.
    max_agents: 0,
    max_whatsapp_numbers: 1,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/plans");
  return { success: true };
}

// Guardado unico del formulario de /admin/plans: precio, insignia, beneficios,
// limites, estado y modulos en una sola accion. Antes eran cuatro botones
// separados y era facil editar un bloque y perderlo por guardar otro.
export async function updatePlan(
  planId: string,
  input: {
    priceCop: number;
    badgeLabel: string;
    isActive: boolean;
    description: string[];
    maxAgents: number | null;
    maxWhatsappNumbers: number | null;
    moduleKeys: string[];
  }
) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  if (!input.priceCop || input.priceCop <= 0) {
    return { error: "Ingresa un precio valido." };
  }

  // Campo vacio = sin insignia. Se guarda null para que las landings no
  // tengan que distinguir entre "" y null.
  const badge = input.badgeLabel.trim();

  const { error: planError } = await supabase
    .from("plans")
    .update({
      price_cents: Math.round(input.priceCop * 100),
      badge_label: badge === "" ? null : badge,
      is_active: input.isActive,
      description: input.description.map((line) => line.trim()).filter(Boolean),
      max_agents: input.maxAgents,
      max_whatsapp_numbers: input.maxWhatsappNumbers,
    })
    .eq("id", planId);

  if (planError) return { error: planError.message };

  // Los modulos son una tabla aparte: se reemplaza el set completo.
  const { data: current } = await supabase
    .from("plan_modules")
    .select("module_key")
    .eq("plan_id", planId);

  const currentKeys = new Set((current ?? []).map((m) => m.module_key));
  const nextKeys = new Set(input.moduleKeys);

  const toAdd = [...nextKeys].filter((k) => !currentKeys.has(k));
  const toRemove = [...currentKeys].filter((k) => !nextKeys.has(k));

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("plan_modules")
      .upsert(toAdd.map((module_key) => ({ plan_id: planId, module_key })));
    if (error) return { error: error.message };
  }

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("plan_modules")
      .delete()
      .eq("plan_id", planId)
      .in("module_key", toRemove);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/plans");
  revalidatePath("/dashboard/billing");
  revalidatePath("/");
  revalidatePath("/bybluee");
  return { success: true as const };
}
