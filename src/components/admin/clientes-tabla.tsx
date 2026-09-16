"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PlanStatusInline } from "@/components/admin/plan-status-inline";
import { WorkspaceRowActions } from "@/components/admin/workspace-row-actions";
import { EditRenewalDateButton } from "@/components/admin/edit-renewal-date-button";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";

export type FilaCliente = {
  id: string;
  name: string;
  email: string;
  fullName: string | null;
  plan: string;
  planId: string | null;
  status: string;
  everActivated: boolean;
  accessDisabled: boolean;
  createdAt: string;
  renewalDate: string | null;
  phone: string | null;
  cliente: string | null;
  hasWhatsapp: boolean;
  signupIp: string | null;
  sharedIp: boolean;
  lastSignInAt: string | null;
};

const statusLabel: Record<string, string> = {
  trialing: "En prueba",
  active: "Activo",
  past_due: "Pago pendiente",
  canceled: "Cancelado",
};

function daysSince(dateStr: string, ahora: number): number {
  return Math.max(0, Math.floor((ahora - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Lista de clientes del Admin con filtro en el cliente: busca mientras se
 * escribe (correo, nombre, empresa, telefono, contacto) y por fecha de
 * creacion, sin volver al servidor. Las filas ya vienen cargadas.
 */
export function ClientesTabla({ rows, plans }: { rows: FilaCliente[]; plans: { id: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [ahora] = useState(() => Date.now());

  const filas = useMemo(() => {
    const t = q.trim().toLowerCase();
    const d = desde ? new Date(desde) : null;
    const h = hasta ? new Date(`${hasta}T23:59:59`) : null;
    return rows.filter((r) => {
      if (t) {
        const campos = [r.email, r.name, r.fullName ?? "", r.phone ?? "", r.cliente ?? ""].map((x) => x.toLowerCase());
        if (!campos.some((c) => c.includes(t))) return false;
      }
      const creado = new Date(r.createdAt);
      if (d && creado < d) return false;
      if (h && creado > h) return false;
      return true;
    });
  }, [rows, q, desde, hasta]);

  const hayFiltro = !!(q || desde || hasta);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por correo, nombre, empresa o teléfono…"
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span>Creado entre</span>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <span>y</span>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        {hayFiltro && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setDesde("");
              setHasta("");
            }}
            className="text-xs text-muted hover:text-foreground"
          >
            Limpiar
          </button>
        )}
        <span className="ml-auto text-xs text-muted">
          {filas.length} de {rows.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-5 py-3 font-medium">Cliente</th>
              <th className="px-5 py-3 font-medium">Teléfono</th>
              <th className="px-5 py-3 font-medium">Plan / Estado</th>
              <th className="px-5 py-3 font-medium">IP de registro</th>
              <th className="px-5 py-3 font-medium">Última conexión</th>
              <th className="px-5 py-3 font-medium">Creado / Renovación</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-b-0">
                <td className="px-5 py-3">
                  <p className="text-foreground">{r.email}</p>
                  {r.fullName && <p className="text-xs text-foreground/80">{r.fullName}</p>}
                  <p className="text-xs text-muted">{r.name}</p>
                </td>
                <td className="px-5 py-3 text-foreground">
                  <p>{r.phone ?? "—"}</p>
                  {r.cliente && (
                    <p className="text-xs text-muted" title="Contacto en tu bandeja">
                      💬 {r.cliente}
                    </p>
                  )}
                  <span
                    title={r.hasWhatsapp ? "API de WhatsApp conectada" : "Sin API de WhatsApp conectada"}
                    className="mt-1 inline-block"
                  >
                    <WhatsAppIcon size={16} className={r.hasWhatsapp ? "text-success" : "text-muted opacity-50"} />
                  </span>
                </td>
                <td className="px-5 py-3">
                  <PlanStatusInline
                    workspaceId={r.id}
                    planId={r.planId}
                    status={r.status}
                    plans={plans}
                    etiquetaEstado={
                      r.status === "past_due" && !r.everActivated ? "Prueba vencida" : (statusLabel[r.status] ?? r.status)
                    }
                  />
                  {r.accessDisabled && (
                    <span className="mt-1 inline-block w-fit rounded-full border border-red-400 px-2 py-0.5 text-xs text-red-400">
                      Acceso desactivado
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <p className="text-muted">{r.signupIp ?? "—"}</p>
                  {r.sharedIp && (
                    <span
                      title="Otro workspace se registró desde esta misma IP"
                      className="mt-1 inline-block w-fit rounded-full border border-warning px-2 py-0.5 text-[10px] text-warning"
                    >
                      Posible multicuenta
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {r.lastSignInAt ? (
                    <>
                      <p className="text-muted">
                        {new Date(r.lastSignInAt).toLocaleString("es-CO", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="text-xs text-muted">Hace {daysSince(r.lastSignInAt, ahora)} día(s)</p>
                    </>
                  ) : (
                    <p className="text-muted">—</p>
                  )}
                </td>
                <td className="px-5 py-3 text-muted">
                  <p>{new Date(r.createdAt).toLocaleDateString("es-CO")}</p>
                  <div className="mt-1 flex items-center gap-1.5 text-xs">
                    <span>
                      {r.renewalDate ? `Renueva: ${new Date(r.renewalDate).toLocaleDateString("es-CO")}` : "Sin renovación"}
                    </span>
                    <EditRenewalDateButton workspaceId={r.id} currentDate={r.renewalDate} />
                  </div>
                </td>
                <td className="px-5 py-3">
                  <WorkspaceRowActions workspaceId={r.id} workspaceName={r.name} accessDisabled={r.accessDisabled} />
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-center text-muted">
                  {hayFiltro ? "Sin resultados para ese filtro." : "Sin clientes registrados."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
