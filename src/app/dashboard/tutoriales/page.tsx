import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { BibliotecaTutoriales, type Tutorial } from "@/components/tutoriales/biblioteca-tutoriales";
import { TarjetaServicio } from "@/components/tutoriales/tarjeta-servicio";

function precioCop(cents: number, currency: string) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: currency || "COP", maximumFractionDigits: 0 }).format(
    cents / 100
  );
}

/**
 * Capacitaciones: arriba la tienda de Servicios de Pago (los cursos de 0117),
 * debajo la biblioteca de tutoriales gratuitos (0116). La tienda va compacta a
 * proposito: tarjetas pequeñas para que las capacitaciones incluidas se vean sin
 * tener que bajar mucho.
 */
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
      .select("id, titulo, portada_url, precio_cents, currency")
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-dash-display text-[22px] font-bold tracking-[-.4px] text-foreground">Capacitaciones</h1>
        <p className="mt-1 text-sm text-muted">Fórmate en ByBluee: capacitaciones cortas de cada módulo y cursos completos.</p>
      </div>

      {(cursos ?? []).length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-dash-display text-[17px] font-bold tracking-[-.3px] text-foreground">Servicios de Pago</h2>
            <p className="mt-0.5 text-xs text-muted">
              Compra con tarjeta, PSE o transferencia. El servicio queda activo en tu cuenta apenas se aprueba el pago.
            </p>
          </div>
          {/* Telefono: fila que se desliza de lado, para no empujar hacia abajo las
              capacitaciones. Desde pantallas medianas: rejilla de columnas fijas, para que
              con 3 servicios las tarjetas no se estiren a todo el ancho. */}
          <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0 sm:[grid-template-columns:repeat(auto-fill,minmax(212px,240px))]">
            {(cursos ?? []).map((c) => (
              <TarjetaServicio
                key={c.id}
                id={c.id}
                titulo={c.titulo}
                portadaUrl={c.portada_url}
                precio={precioCop(c.precio_cents, c.currency)}
                gratis={c.precio_cents <= 0}
                comprado={comprados.has(c.id)}
              />
            ))}
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
