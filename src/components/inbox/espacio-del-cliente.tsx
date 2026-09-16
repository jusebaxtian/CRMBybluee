import Link from "next/link";
import { Building2, ExternalLink, Link2 } from "lucide-react";
import { EnlaceInvitacion } from "@/components/inbox/enlace-invitacion";

export type EspacioDelCliente = {
  workspace_id: string;
  workspace_name: string;
  status: string;
  plan_name: string | null;
  vence: string | null;
  apis_conectadas: number;
  origen: "manual" | "telefono";
};

/** Enlace de registro con pago pendiente de usar (migracion 0105). */
export type InvitacionPendiente = {
  id: string;
  enlace: string;
  plan_name: string | null;
  amount_cents: number;
  currency: string;
  created_at: string;
};

const ESTADOS: Record<string, string> = {
  active: "Activo",
  trial: "En prueba",
  past_due: "Pago pendiente",
  suspended: "Suspendido",
  cancelled: "Cancelado",
};

function formatoMonto(cents: number, currency: string) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: currency || "COP", maximumFractionDigits: 0 }).format(
    cents / 100
  );
}

/**
 * Tarjeta del panel de contacto, solo para el administrador de la
 * plataforma: qué espacio compró la persona con la que está hablando y,
 * si se le generó un enlace de registro con pago, el enlace para copiarlo.
 */
export function EspacioDelClienteCard({
  espacios,
  invitaciones = [],
}: {
  espacios: EspacioDelCliente[];
  invitaciones?: InvitacionPendiente[];
}) {
  if (espacios.length === 0 && invitaciones.length === 0) return null;

  return (
    <div className="mt-6 flex flex-col gap-3">
      {espacios.length > 0 && (
        <div className="rounded-[13px] border border-primary/30 bg-primary/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Building2 size={13} />
            {espacios.length === 1 ? "Espacio de este cliente" : "Espacios de este cliente"}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {espacios.map((e) => {
              const vence = e.vence
                ? new Date(e.vence).toLocaleDateString("es-CO", { day: "2-digit", month: "short", timeZone: "America/Bogota" })
                : null;
              return (
                <li key={e.workspace_id} className="text-xs">
                  <Link
                    href={`/admin/workspaces/${e.workspace_id}`}
                    className="flex items-center gap-1 font-semibold text-foreground hover:underline"
                  >
                    <span className="truncate">{e.workspace_name}</span>
                    <ExternalLink size={11} className="shrink-0 text-muted" />
                  </Link>
                  <p className="text-muted">
                    {[
                      e.plan_name ?? "Sin plan",
                      ESTADOS[e.status] ?? e.status,
                      vence ? `vence ${vence}` : null,
                      `${e.apis_conectadas} API${Number(e.apis_conectadas) === 1 ? "" : "s"}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {invitaciones.length > 0 && (
        <div className="rounded-[13px] border border-warning/40 bg-warning/10 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Link2 size={13} className="text-warning" />
            {invitaciones.length === 1 ? "Enlace de registro pendiente" : "Enlaces de registro pendientes"}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {invitaciones.map((i) => (
              <li key={i.id} className="text-xs">
                <p className="text-muted">
                  {i.plan_name ?? "Plan"} · {formatoMonto(i.amount_cents, i.currency)} ·{" "}
                  {new Date(i.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", timeZone: "America/Bogota" })}
                </p>
                <EnlaceInvitacion enlace={i.enlace} />
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] text-muted">Aún no ha creado su cuenta. Toca el enlace para copiarlo y reenviárselo.</p>
        </div>
      )}
    </div>
  );
}
