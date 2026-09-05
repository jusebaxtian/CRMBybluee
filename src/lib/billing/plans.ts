import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type PlanWithFeatures = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  billing_cycle: string;
  /** Lineas libres escritas en plans.description desde /admin/plans. */
  description: string[];
  /** Nombres de los modulos habilitados para el plan (plan_modules -> modules.name). */
  modules: string[];
  /** description + modules, en el orden en que se muestran. */
  features: string[];
};

export const cycleLabel: Record<string, string> = {
  monthly: "mes",
  semiannual: "6 meses",
  yearly: "año",
};

export function planCycleLabel(billingCycle: string): string {
  return cycleLabel[billingCycle] ?? billingCycle;
}

// Fuente unica de verdad para las caracteristicas de cada plan: lo mismo que ve
// el cliente en Facturacion se muestra en la landing publica. No hardcodear
// listas de features en las paginas.
export async function getActivePlansWithFeatures(
  supabase: SupabaseServerClient
): Promise<PlanWithFeatures[]> {
  const [{ data: plans }, { data: modules }, { data: planModules }] = await Promise.all([
    supabase
      .from("plans")
      .select("id, name, price_cents, currency, billing_cycle, description")
      .eq("is_active", true)
      .order("price_cents"),
    supabase.from("modules").select("key, name"),
    supabase.from("plan_modules").select("plan_id, module_key"),
  ]);

  const moduleNameByKey = new Map((modules ?? []).map((m) => [m.key, m.name]));
  const modulesByPlan = new Map<string, string[]>();
  for (const pm of planModules ?? []) {
    const name = moduleNameByKey.get(pm.module_key);
    if (!name) continue;
    if (!modulesByPlan.has(pm.plan_id)) modulesByPlan.set(pm.plan_id, []);
    modulesByPlan.get(pm.plan_id)!.push(name);
  }

  return (plans ?? []).map((p) => {
    const description = (p.description ?? []) as string[];
    // Orden alfabetico para que la lista sea estable entre paginas y recargas.
    const planModuleNames = (modulesByPlan.get(p.id) ?? []).sort((a, b) =>
      a.localeCompare(b, "es")
    );

    return {
      id: p.id,
      name: p.name,
      price_cents: p.price_cents,
      currency: p.currency,
      billing_cycle: p.billing_cycle,
      description,
      modules: planModuleNames,
      features: [...description, ...planModuleNames],
    };
  });
}
