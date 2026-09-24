import Link from "next/link";
import { Lock, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { BibliotecaTutoriales, type Tutorial } from "@/components/tutoriales/biblioteca-tutoriales";

function precioCop(cents: number, currency: string) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: currency || "COP", maximumFractionDigits: 0 }).format(
    cents / 100
  );
}

/** Biblioteca de tutoriales gratuitos (0116) + cursos de pago (0117). */
export default async function TutorialesPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { ver } = await searchParams;
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);

  const [{ data: gratuitos }, { data: cursos }, { data: compras }] = await Promise.all([
    supabase
      .from("tutoriales")
      .select("id, titulo, descripcion, url, modulo, duracion")
      .eq("activo", true)
      .is("curso_id", null)
      .order("orden")
      .order("created_at"),
    supabase
      .from("cursos")
      .select("id, titulo, descripcion, portada_url, precio_cents, currency")
      .eq("activo", true)
      .order("orden")
      .order("created_at"),
    supabase
      .from("curso_compras")
      .select("curso_id, status")
      .eq("workspace_id", workspaceId ?? ""),
  ]);

  const comprados = new Set((compras ?? []).filter((c) => c.status === "approved").map((c) => c.curso_id));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-dash-display text-[22px] font-bold tracking-[-.4px] text-foreground">Capacitaciones</h1>
        <p className="mt-1 text-sm text-muted">Fórmate en ByBluee: capacitaciones cortas de cada módulo y cursos completos.</p>
      </div>

      {(cursos ?? []).length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-dash-display text-[17px] font-bold tracking-[-.3px] text-foreground">Cursos</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(cursos ?? []).map((c) => {
              const tiene = comprados.has(c.id);
              return (
                <Link
                  key={c.id}
                  href={`/dashboard/tutoriales/curso/${c.id}`}
                  className="group flex flex-col overflow-hidden rounded-[13px] border border-border bg-surface transition-colors hover:border-primary/60"
                >
                  <div className="relative aspect-video w-full bg-gradient-to-br from-[#16351f] to-[#0e1411]">
                    {c.portada_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.portada_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white">
                      {tiene ? "Comprado ✓" : c.precio_cents > 0 ? precioCop(c.precio_cents, c.currency) : "Gratis"}
                    </span>
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform group-hover:scale-110">
                        {tiene ? <PlayCircle size={18} /> : <Lock size={16} />}
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 p-3">
                    <p className="text-[13.5px] font-semibold text-foreground">{c.titulo}</p>
                    {c.descripcion && <p className="line-clamp-2 text-xs text-muted">{c.descripcion}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        {(cursos ?? []).length > 0 && (
          <h2 className="font-dash-display text-[17px] font-bold tracking-[-.3px] text-foreground">Capacitaciones incluidas</h2>
        )}
        <BibliotecaTutoriales tutoriales={(gratuitos ?? []) as Tutorial[]} abrirInicial={ver ?? null} />
      </section>
    </div>
  );
}
