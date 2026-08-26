import { createClient } from "@/lib/supabase/server";
import { CreatePlanForm } from "@/components/create-plan-form";
import { PlanPriceEditor } from "@/components/plan-price-editor";
import { PlanModuleToggle } from "@/components/plan-module-toggle";
import { PlanActiveToggle } from "@/components/plan-active-toggle";
import { PlanDescriptionEditor } from "@/components/plan-description-editor";
import { PlanLimitsEditor } from "@/components/plan-limits-editor";

export default async function AdminPlansPage() {
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, price_cents, is_active, description, max_agents, max_whatsapp_numbers")
    .order("price_cents");

  const { data: modules } = await supabase
    .from("modules")
    .select("key, name")
    .order("name");

  const { data: planModules } = await supabase.from("plan_modules").select("plan_id, module_key");

  const enabledByPlan = new Map<string, Set<string>>();
  for (const pm of planModules ?? []) {
    if (!enabledByPlan.has(pm.plan_id)) enabledByPlan.set(pm.plan_id, new Set());
    enabledByPlan.get(pm.plan_id)!.add(pm.module_key);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Planes</h1>
        <p className="text-sm text-muted">
          Define precios, beneficios visibles y qué módulos incluye cada plan
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="mb-3 text-sm font-medium text-foreground">Nuevo plan</p>
        <CreatePlanForm />
      </div>

      <div className="flex flex-col gap-4">
        {(plans ?? []).map((plan) => {
          const enabled = enabledByPlan.get(plan.id) ?? new Set();
          return (
            <div key={plan.id} className="rounded-xl border border-border bg-surface p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-foreground">{plan.name}</p>
                <div className="flex items-center gap-3">
                  <PlanActiveToggle planId={plan.id} isActive={plan.is_active} />
                  <PlanPriceEditor planId={plan.id} initialPriceCents={plan.price_cents} />
                </div>
              </div>

              <div className="mb-4">
                <PlanDescriptionEditor planId={plan.id} initialDescription={plan.description ?? []} />
              </div>

              <div className="mb-4 rounded-lg border border-border bg-background p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                  Límites del plan
                </p>
                <PlanLimitsEditor
                  planId={plan.id}
                  initialMaxAgents={plan.max_agents}
                  initialMaxWhatsappNumbers={plan.max_whatsapp_numbers}
                />
              </div>

              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                Módulos incluidos
              </p>
              <div className="flex flex-wrap gap-4">
                {(modules ?? []).map((m) => (
                  <PlanModuleToggle
                    key={m.key}
                    planId={plan.id}
                    moduleKey={m.key}
                    moduleName={m.name}
                    enabled={enabled.has(m.key)}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {(!plans || plans.length === 0) && (
          <p className="text-sm text-muted">No hay planes creados todavía.</p>
        )}
      </div>
    </div>
  );
}
