import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { cargarPendientes } from "@/lib/dashboard/datos";

function haceCuanto(min: number): string {
  if (min < 60) return `hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h ${min % 60}m`;
  const d = Math.floor(h / 24);
  return `hace ${d} ${d === 1 ? "día" : "días"}`;
}

export async function Pendientes() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return null;

  const pendientes = await cargarPendientes(supabase, workspaceId, 5);

  return (
    <section
      aria-label="Pendientes de responder"
      className="flex flex-col gap-[14px] rounded-[13px] border border-dash-border bg-dash-card p-5"
    >
      <header className="flex items-center justify-between">
        <h2 className="font-dash-ui text-[15px] font-semibold text-dash-text">Pendientes de responder</h2>
        <Link
          href="/dashboard/inbox?filtro=no-leidos"
          className="font-dash-ui text-[12px] font-semibold text-dash-green-text hover:underline"
        >
          Ver todo
        </Link>
      </header>

      {pendientes.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-8 font-dash-ui text-[13px] text-dash-text-3">
          Todo respondido 🎉
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pendientes.map((p) => (
            <li key={p.id}>
              <Link
                href={`/dashboard/inbox/${p.id}`}
                className={`flex items-center gap-3 rounded-[10px] border px-3 py-[10px] transition-colors duration-150 ${
                  p.urgente
                    ? "border-dash-red-28 bg-dash-red-7 hover:bg-[rgba(248,113,113,0.11)]"
                    : "border-dash-border-soft hover:bg-dash-surface-subtle"
                }`}
              >
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] font-dash-ui text-[13px] font-semibold text-dash-text"
                >
                  {p.inicial}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-dash-ui text-[13px] font-semibold text-dash-text">{p.nombre}</span>
                  <span className="block truncate font-dash-ui text-[11.5px] text-dash-text-3">
                    {p.contexto} · {haceCuanto(p.minutosEspera)}
                  </span>
                </span>
                {p.urgente && <span className="shrink-0 font-dash-ui text-[11px] font-bold text-dash-red">24h</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
