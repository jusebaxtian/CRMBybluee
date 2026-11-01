import Link from "next/link";
import { Building2, MessageSquare } from "lucide-react";
import { DIAS_POR_VENCER, type ClienteResumen, type ClientesPorEstado } from "@/lib/fidelidad/clientes-por-estado";

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" }) : "—";

function detalle(c: ClienteResumen, grupo: keyof ClientesPorEstado): string {
  if (c.dias === null) return "Sin fecha de vencimiento";
  if (grupo === "vencidos") return c.dias < 0 ? `Venció hace ${-c.dias} ${c.dias === -1 ? "día" : "días"} · ${fecha(c.vence)}` : `Vence ${fecha(c.vence)}`;
  if (c.dias <= 0) return "Vence hoy";
  return `Vence en ${c.dias} ${c.dias === 1 ? "día" : "días"} · ${fecha(c.vence)}`;
}

const COLUMNAS: { clave: keyof ClientesPorEstado; titulo: string; color: string; punto: string }[] = [
  { clave: "activos", titulo: "Clientes activos", color: "text-success", punto: "bg-success" },
  { clave: "porVencer", titulo: `Por vencer (${DIAS_POR_VENCER} días)`, color: "text-warning", punto: "bg-warning" },
  { clave: "vencidos", titulo: "Clientes vencidos", color: "text-error", punto: "bg-error" },
];

/** Admin → Plan de fidelidad: los clientes en tres columnas, con acceso a su chat y a su espacio. */
export function ClientesPorEstadoPanel({ grupos }: { grupos: ClientesPorEstado }) {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      {COLUMNAS.map((col) => {
        const lista = grupos[col.clave];
        return (
          <div key={col.clave} className="flex flex-col rounded-xl border border-border bg-surface">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className={`flex items-center gap-2 text-sm font-semibold ${col.color}`}>
                <span className={`h-2 w-2 rounded-full ${col.punto}`} />
                {col.titulo}
              </p>
              <span className={`text-xl font-bold ${col.color}`}>{lista.length}</span>
            </header>
            <ul className="max-h-[360px] divide-y divide-border overflow-y-auto">
              {lista.length === 0 && <li className="px-4 py-6 text-center text-xs text-muted">Ninguno.</li>}
              {lista.map((c) => (
                <li key={c.workspaceId} className="flex items-center gap-2 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {c.nombre}
                      {c.esDemo && (
                        <span className="ml-1.5 rounded-full bg-pink-500/15 px-1.5 py-0.5 text-[10px] font-bold text-pink-500">DEMO</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {c.plan ?? "Sin plan"} · {detalle(c, col.clave)}
                    </p>
                  </div>
                  {c.conversationId ? (
                    <Link
                      href={`/dashboard/inbox/${c.conversationId}`}
                      title="Ir al chat con este cliente"
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-foreground hover:border-primary hover:text-primary"
                    >
                      <MessageSquare size={12} /> Chat
                    </Link>
                  ) : (
                    <span
                      title="No hay un chat enlazado a este cliente"
                      className="flex shrink-0 cursor-default items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted/50"
                    >
                      <MessageSquare size={12} /> Chat
                    </span>
                  )}
                  <Link
                    href={`/admin/workspaces/${c.workspaceId}`}
                    title="Ir al espacio del cliente"
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-foreground hover:border-primary hover:text-primary"
                  >
                    <Building2 size={12} /> Espacio
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
