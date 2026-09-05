import { createClient } from "@/lib/supabase/server";
import { CreatePlanForm } from "@/components/create-plan-form";
import { PlanEditor } from "@/components/plan-editor";

export default async function AdminPlansPage() {
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("plans")
    .select(
      "id, name, price_cents, compare_price_cents, is_active, description, max_agents, max_whatsapp_numbers, badge_label"
    )
    .order("price_cents");

  const { data: modules } = await supabase
    .from("modules")
    .select("key, name")
    .order("name");

  const { data: planModules } = await supabase.from("plan_modules").select("plan_id, module_key");

  const enabledByPlan = new Map<string, string[]>();
  for (const pm of planModules ?? []) {
    if (!enabledByPlan.has(pm.plan_id)) enabledByPlan.set(pm.plan_id, []);
    enabledByPlan.get(pm.plan_id)!.push(pm.module_key);
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
        {(plans ?? []).map((plan) => (
          <div key={plan.id} className="rounded-xl border border-border bg-surface p-5">
            <PlanEditor
              planId={plan.id}
              initialName={plan.name}
              initialPriceCents={plan.price_cents}
              initialComparePriceCents={plan.compare_price_cents}
              initialBadgeLabel={plan.badge_label}
              initialIsActive={plan.is_active}
              initialDescription={plan.description ?? []}
              initialMaxAgents={plan.max_agents}
              initialMaxWhatsappNumbers={plan.max_whatsapp_numbers}
              modules={modules ?? []}
              initialModuleKeys={enabledByPlan.get(plan.id) ?? []}
            />
          </div>
        ))}
        {(!plans || plans.length === 0) && (
          <p className="text-sm text-muted">No hay planes creados todavía.</p>
        )}
      </div>
    </div>
  );
}
