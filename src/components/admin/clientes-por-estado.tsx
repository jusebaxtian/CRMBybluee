import Link from "next/link";
import { Building2, MessageSquare } from "lucide-react";
import { DIAS_POR_VENCER, type ClienteResumen, type ClientesPorEstado, type SemaforoUso } from "@/lib/fidelidad/clientes-por-estado";

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" }) : "—";

function detalle(c: ClienteResumen, grupo: keyof ClientesPorEstado): string {
  if (c.dias === null) return "Sin fecha de vencimiento";
  if (grupo === "vencidos") return c.dias < 0 ? `Venció hace ${-c.dias} ${c.dias === -1 ? "día" : "días"} · ${fecha(c.vence)}` : `Vence ${fecha(c.vence)}`;
  if (c.dias <= 0) return "Vence hoy";
  return `Vence en ${c.dias} ${c.dias === 1 ? "día" : "días"} · ${fecha(c.vence)}`;
}

const DIA_MS = 86_400_000;

const SEMAFORO: Record<SemaforoUso, { punto: string; texto: string; nombre: string }> = {
  verde: { punto: "bg-success", texto: "text-success", nombre: "Usó la herramienta en los últimos 7 días: probable que renueve" },
  amarillo: { punto: "bg-warning", texto: "text-warning", nombre: "La usó, pero no en los últimos 7 días: puede no renovar" },
  rojo: { punto: "bg-error", texto: "text-error", nombre: "Nunca ha enviado mensajes: difícil que renueve" },
};

function textoUso(c: ClienteResumen): string {
  if (c.uso === "verde") return `${c.enviados7d.toLocaleString("es-CO")} ${c.enviados7d === 1 ? "mensaje enviado" : "mensajes enviados"} en 7 días`;
  if (c.uso === "amarillo" && c.ultimoEnvio) {
    const hace = Math.floor((Date.now() - new Date(c.ultimoEnvio).getTime()) / DIA_MS);
    return `Sin envíos en 7 días · último hace ${hace} días`;
  }
  return "Nunca ha enviado mensajes";
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
            <div className="flex items-center gap-3 border-b border-border px-4 py-1.5 text-[11px] text-muted">
              {(["verde", "amarillo", "rojo"] as const).map((u) => (
                <span key={u} title={SEMAFORO[u].nombre} className="flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${SEMAFORO[u].punto}`} />
                  {lista.filter((c) => c.uso === u).length}
                </span>
              ))}
              <span className="ml-auto">uso en 7 días</span>
            </div>
            <ul className="max-h-[360px] divide-y divide-border overflow-y-auto">
              {lista.length === 0 && <li className="px-4 py-6 text-center text-xs text-muted">Ninguno.</li>}
              {lista.map((c) => (
                <li key={c.workspaceId} className="flex items-center gap-2 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                      <span title={SEMAFORO[c.uso].nombre} className={`h-2.5 w-2.5 shrink-0 rounded-full ${SEMAFORO[c.uso].punto}`} />
                      <span className="truncate">{c.nombre}</span>
                      {c.esDemo && (
                        <span className="ml-1.5 rounded-full bg-pink-500/15 px-1.5 py-0.5 text-[10px] font-bold text-pink-500">DEMO</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {c.plan ?? "Sin plan"} · {detalle(c, col.clave)}
                    </p>
                    <p className={`truncate text-[11px] font-medium ${SEMAFORO[c.uso].texto}`} title={SEMAFORO[c.uso].nombre}>
                      {textoUso(c)}
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
