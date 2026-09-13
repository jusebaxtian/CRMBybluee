import Link from "next/link";
import { Building2, ExternalLink } from "lucide-react";

export type EspacioDelCliente = {
  workspace_id: string;
  workspace_name: string;
  status: string;
  plan_name: string | null;
  vence: string | null;
  apis_conectadas: number;
  origen: "manual" | "telefono";
};

const ESTADOS: Record<string, string> = {
  active: "Activo",
  trial: "En prueba",
  past_due: "Pago pendiente",
  suspended: "Suspendido",
  cancelled: "Cancelado",
};

/**
 * Tarjeta del panel de contacto, solo para el administrador de la
 * plataforma: qué espacio compró la persona con la que está hablando.
 */
export function EspacioDelClienteCard({ espacios }: { espacios: EspacioDelCliente[] }) {
  if (espacios.length === 0) return null;

  return (
    <div className="mt-6 rounded-[13px] border border-primary/30 bg-primary/5 p-3">
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
  );
}
