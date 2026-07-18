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
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/plans");
  return { success: true };
}

export async function updatePlanPrice(planId: string, priceCop: number) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  const { error } = await supabase
    .from("plans")
    .update({ price_cents: Math.round(priceCop * 100) })
    .eq("id", planId);

  if (error) return { error: error.message };
  revalidatePath("/admin/plans");
  return { success: true };
}

export async function togglePlanModule(planId: string, moduleKey: string, enabled: boolean) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  if (enabled) {
    await supabase.from("plan_modules").upsert({ plan_id: planId, module_key: moduleKey });
  } else {
    await supabase
      .from("plan_modules")
      .delete()
      .eq("plan_id", planId)
      .eq("module_key", moduleKey);
  }

  revalidatePath("/admin/plans");
  return { success: true };
}

export async function togglePlanActive(planId: string, isActive: boolean) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  await supabase.from("plans").update({ is_active: isActive }).eq("id", planId);
  revalidatePath("/admin/plans");
  return { success: true };
}
