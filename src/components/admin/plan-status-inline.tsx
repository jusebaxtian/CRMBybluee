"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { updateWorkspacePlan, updateWorkspaceStatus } from "@/app/actions/admin";

type Plan = { id: string; name: string };

const ESTADOS: { valor: string; nombre: string; clase: string }[] = [
  { valor: "trialing", nombre: "Prueba", clase: "border-warning text-warning" },
  { valor: "active", nombre: "Activo", clase: "border-success text-success" },
  { valor: "past_due", nombre: "Pago pendiente", clase: "border-error text-error" },
  { valor: "canceled", nombre: "Cancelado", clase: "border-border text-muted" },
];

/**
 * Plan y estado editables directo en la fila de la lista de clientes (Admin),
 * con las mismas acciones que la ficha del cliente. Se ven como texto/pastilla
 * y al hacer clic son un desplegable; el cambio se guarda al elegir.
 */
export function PlanStatusInline({
  workspaceId,
  planId,
  status,
  plans,
  etiquetaEstado,
}: {
  workspaceId: string;
  planId: string | null;
  status: string;
  plans: Plan[];
  /** Texto que se muestra (p. ej. "Prueba vencida" cuando nunca se activo). */
  etiquetaEstado: string;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState<"plan" | "estado" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const estado = ESTADOS.find((e) => e.valor === status);

  async function cambiarPlan(nuevo: string) {
    if (!nuevo || nuevo === planId) return;
    setGuardando("plan");
    setError(null);
    const r = await updateWorkspacePlan(workspaceId, nuevo);
    setGuardando(null);
    if (r?.error) setError(r.error);
    else router.refresh();
  }

  async function cambiarEstado(nuevo: string) {
    if (nuevo === status) return;
    setGuardando("estado");
    setError(null);
    const r = await updateWorkspaceStatus(workspaceId, nuevo);
    setGuardando(null);
    if (r?.error) setError(r.error);
    else router.refresh();
  }

  const select =
    "cursor-pointer appearance-none rounded-md border bg-transparent pr-5 outline-none focus:border-primary disabled:opacity-50 " +
    "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%2210%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%239a9aa8%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:10px] bg-[right_6px_center] bg-no-repeat";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <select
          value={planId ?? ""}
          onChange={(e) => cambiarPlan(e.target.value)}
          disabled={guardando !== null}
          title="Cambiar plan"
          className={`${select} border-transparent py-0.5 pl-1 text-sm text-foreground hover:border-border`}
        >
          {!planId && <option value="">—</option>}
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {guardando === "plan" && <Loader2 size={12} className="animate-spin text-muted" />}
      </div>
      <div className="flex items-center gap-1.5">
        <select
          value={status}
          onChange={(e) => cambiarEstado(e.target.value)}
          disabled={guardando !== null}
          title="Cambiar estado"
          className={`${select} rounded-full py-0.5 pl-2 text-xs ${estado?.clase ?? "border-border text-muted"}`}
        >
          {ESTADOS.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.valor === status ? etiquetaEstado : e.nombre}
            </option>
          ))}
        </select>
        {guardando === "estado" && <Loader2 size={12} className="animate-spin text-muted" />}
      </div>
      {error && <p className="text-[11px] text-error">{error}</p>}
    </div>
  );
}
