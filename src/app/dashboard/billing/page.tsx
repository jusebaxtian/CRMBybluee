import { CheckCircle2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceId, getWorkspaceRole } from "@/lib/workspace";
import { createBoldOrder, confirmBoldPayment } from "@/app/actions/billing";
import { confirmarPagoWompi } from "@/app/actions/wompi";
import { wompiPermitidoPara } from "@/lib/wompi";
import { PlanPicker } from "@/components/billing/plan-picker";
import { OpcionesDePago } from "@/components/billing/opciones-de-pago";
import { DatosLegales } from "@/components/billing/datos-legales";
import { DescargarSoporte } from "@/components/billing/descargar-soporte";
import { getActivePlansWithFeatures, planCycleLabel, formatCents } from "@/lib/billing/plans";
import { proximoPlan } from "@/lib/billing/cambio-de-plan";

const statusLabel: Record<string, string> = {
  trialing: "En periodo de prueba",
  active: "Activo",
  past_due: "Pago pendiente",
  canceled: "Cancelado",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const boldOrderId = typeof params["bold-order-id"] === "string" ? params["bold-order-id"] : null;
  const boldTxStatus = typeof params["bold-tx-status"] === "string" ? params["bold-tx-status"] : null;
  if (boldOrderId) {
    await confirmBoldPayment(boldOrderId, boldTxStatus);
  }
  // Wompi regresa al cliente con ?id=<transaccion>.
  const wompiTxId = typeof params.id === "string" ? params.id : null;
  if (wompiTxId) {
    await confirmarPagoWompi(wompiTxId);
  }
  const planParam = typeof params.plan === "string" ? params.plan : null;

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  const wompiDisponible = wompiPermitidoPara(workspaceId);

  const { data: workspaceRow } = workspaceId
    ? await supabase
        .from("workspaces")
        .select(
          "status, trial_ends_at, plan_id, phone, razon_social, documento_tipo, documento_numero, direccion, datos_legales_el, plans(name, price_cents, billing_cycle)"
        )
        .eq("id", workspaceId)
        .maybeSingle()
    : { data: null };

  const workspace = workspaceRow as unknown as
    | {
        status: string;
        trial_ends_at: string;
        plan_id: string | null;
        phone: string | null;
        razon_social: string | null;
        documento_tipo: string | null;
        documento_numero: string | null;
        direccion: string | null;
        datos_legales_el: string | null;
        plans: { name: string; price_cents: number; billing_cycle: string } | null;
      }
    | null;

  // Datos legales de la empresa: salen impresos en cada soporte de compra. Se
  // registran una vez y despues quedan bloqueados. El correo que se muestra es el
  // del dueño de la cuenta, no el de quien este mirando la pantalla.
  const rolEnElEspacio = await getWorkspaceRole(supabase, workspaceId);
  const puedeRegistrarDatos = rolEnElEspacio === "owner" || rolEnElEspacio === "admin";
  let correoDelDueno: string | null = null;
  if (workspaceId) {
    const admin = createAdminClient();
    const { data: dueno } = await admin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();
    if (dueno?.user_id) {
      const { data } = await admin.auth.admin.getUserById(dueno.user_id);
      correoDelDueno = data.user?.email ?? null;
    }
  }
  const datosLegalesGuardados =
    workspace?.datos_legales_el && workspace.documento_numero
      ? {
          razonSocial: workspace.razon_social ?? "",
          documentoTipo: workspace.documento_tipo ?? "OTRO",
          documentoNumero: workspace.documento_numero,
          direccion: workspace.direccion ?? "",
        }
      : null;

  const { data: payments } = await supabase
    .from("payments")
    .select("id, provider, amount_cents, status, created_at")
    .eq("workspace_id", workspaceId ?? "")
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: activeSubscription } = await supabase
    .from("subscriptions")
    .select("current_period_end")
    .eq("workspace_id", workspaceId ?? "")
    .eq("status", "active")
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  const renewalDate = activeSubscription?.current_period_end
    ? new Date(activeSubscription.current_period_end)
    : null;
  const daysUntilRenewal = renewalDate
    ? Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const esActivo = workspace?.status === "active";

  // Only offer payment when there's actually something to pay for: not active
  // yet, past due, or the active subscription is within 2 days of renewing.
  const canPay = !esActivo || (daysUntilRenewal !== null && daysUntilRenewal <= 2);

  // Un cliente activo ve siempre los planes, para poder subir de nivel; los
  // demas, solo cuando hay algo que pagar.
  let plansForPicker: Awaited<ReturnType<typeof getActivePlansWithFeatures>> = [];
  if (canPay || esActivo) {
    plansForPicker = await getActivePlansWithFeatures(supabase);
  }

  const precioActual = workspace?.plans?.price_cents ?? 0;
  // El siguiente nivel es el plan activo inmediatamente mas caro que el actual.
  const proximoPlanId = proximoPlan(plansForPicker, precioActual)?.id ?? null;
  // Plan al que quiere cambiar (llega en ?plan=). Solo si ya es cliente activo y
  // el plan existe y es otro distinto del suyo.
  const planElegido =
    esActivo && planParam ? plansForPicker.find((p) => p.id === planParam && p.id !== workspace?.plan_id) ?? null : null;

  // La orden de Bold se arma aqui, en el servidor, con el precio del plan sacado
  // de la base. Para el cambio de plan, la del plan elegido; si no, la del actual.
  const boldOrderCambio = planElegido ? await createBoldOrder(planElegido.id) : null;
  const boldOrder =
    canPay && !planElegido && precioActual > 0 ? await createBoldOrder(workspace?.plan_id ?? null) : null;

  const cicloActual = planCycleLabel(workspace?.plans?.billing_cycle ?? "monthly");

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[13px] border border-border bg-surface p-5">
        <p className="text-sm text-muted">Plan actual</p>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-2xl font-semibold text-foreground">{workspace?.plans?.name ?? "—"}</p>
          <p className="text-sm text-muted">
            ${formatCents(precioActual)} COP/{cicloActual}
          </p>
        </div>
        <p className="mt-1 text-sm text-muted">
          Estado: {workspace ? statusLabel[workspace.status] ?? workspace.status : "—"}
        </p>
      </div>

      {(workspace?.status === "past_due" || workspace?.status === "canceled") && (
        <div className="flex items-center gap-3 rounded-xl border border-red-400/30 bg-red-400/10 p-5">
          <AlertTriangle size={20} className="shrink-0 text-red-400" />
          <p className="text-sm text-foreground">
            {workspace.status === "past_due"
              ? "Activa un plan para empezar a usar tu cuenta."
              : "Tu suscripción está cancelada. Compra un plan para reactivar tu cuenta."}
          </p>
        </div>
      )}

      {!canPay && renewalDate && (
        <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 p-5">
          <CheckCircle2 size={20} className="shrink-0 text-success" />
          <p className="text-sm text-foreground">
            Tu plan está pagado y activo. Se habilitará el pago para renovar 2 días antes del{" "}
            {renewalDate.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}.
          </p>
        </div>
      )}

      {/* ---- Cliente activo: ver planes, subir de nivel, renovar ---- */}
      {esActivo && plansForPicker.length > 0 && (
        <div>
          <p className="text-sm font-medium text-foreground">Planes</p>
          <p className="mb-3 mt-0.5 text-xs text-muted">
            Compara y cambia de plan cuando quieras. Tu plan cambia cuando se aprueba el pago, no antes.
          </p>
          <PlanPicker
            plans={plansForPicker}
            currentPlanId={workspace?.plan_id ?? null}
            modoCambio
            proximoPlanId={proximoPlanId}
          />
        </div>
      )}

      {planElegido && (
        <section id="pagar" className="flex flex-col gap-4 scroll-mt-4">
          <div className="rounded-[13px] border border-primary/40 bg-primary/5 p-5">
            <p className="text-sm text-muted">Vas a cambiar de plan</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {workspace?.plans?.name ?? "Tu plan"} → {planElegido.name}
            </p>
            <p className="mt-0.5 text-sm text-foreground">
              ${formatCents(planElegido.price_cents)} {planElegido.currency} / {planCycleLabel(planElegido.billing_cycle)}
            </p>
            <ul className="mt-3 flex list-disc flex-col gap-1 pl-4 text-xs text-muted">
              <li>Pagas el precio completo del nuevo plan.</li>
              <li>El cambio se aplica cuando tu pago se aprueba. Hasta entonces sigues con tu plan actual.</li>
              <li>El periodo del nuevo plan empieza ese día.</li>
            </ul>
            <a href="/dashboard/billing" className="mt-3 inline-block text-xs text-muted underline hover:text-foreground">
              Cancelar y volver
            </a>
          </div>
          <OpcionesDePago
            boldOrder={boldOrderCambio}
            descripcion={`Cambio a ${planElegido.name}`}
            planId={planElegido.id}
            montoSugeridoCop={planElegido.price_cents / 100}
            wompiDisponible={wompiDisponible}
          />
        </section>
      )}

      {esActivo && canPay && !planElegido && (
        <section className="flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground">Renovar tu plan</p>
          <OpcionesDePago
            boldOrder={boldOrder}
            descripcion={`Suscripción ${workspace?.plans?.name ?? "CRM Bybluee"}`}
            planId={workspace?.plan_id ?? undefined}
            montoSugeridoCop={precioActual / 100}
            wompiDisponible={wompiDisponible}
          />
        </section>
      )}

      {/* ---- Sin plan pagado todavia (prueba, pago pendiente, cancelado): como siempre ---- */}
      {!esActivo && canPay && plansForPicker.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">Elige tu plan</p>
          <PlanPicker plans={plansForPicker} currentPlanId={workspace?.plan_id ?? null} />
        </div>
      )}

      {!esActivo && canPay && (
        <OpcionesDePago
          boldOrder={boldOrder}
          descripcion={`Suscripción ${workspace?.plans?.name ?? "CRM Bybluee"}`}
          planId={workspace?.plan_id ?? undefined}
          montoSugeridoCop={precioActual > 0 ? precioActual / 100 : undefined}
          wompiDisponible={wompiDisponible}
        />
      )}

      <DatosLegales
        guardados={datosLegalesGuardados}
        correo={correoDelDueno}
        telefono={workspace?.phone ?? null}
        puedeRegistrar={puedeRegistrarDatos}
      />

      <div className="overflow-hidden rounded-[13px] border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-5 py-3 font-medium">Fecha</th>
              <th className="px-5 py-3 font-medium">Método</th>
              <th className="px-5 py-3 font-medium">Monto</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3 font-medium">Cuenta de cobro</th>
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).map((p) => (
              <tr key={p.id} className="border-b border-border last:border-b-0">
                <td className="px-5 py-3 text-muted">{new Date(p.created_at).toLocaleDateString("es-CO")}</td>
                <td className="px-5 py-3 text-foreground">{p.provider === "bold" ? "Bold" : p.provider === "wompi" ? "Wompi" : "Transferencia"}</td>
                <td className="px-5 py-3 text-foreground">${(p.amount_cents / 100).toLocaleString("es-CO")}</td>
                <td className="px-5 py-3 text-muted">{p.status}</td>
                <td className="px-5 py-3">
                  {p.status === "approved" ? (
                    <DescargarSoporte paymentId={p.id} datosListos={!!datosLegalesGuardados} />
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {(!payments || payments.length === 0) && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-muted">
                  Sin pagos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
