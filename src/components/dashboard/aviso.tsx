import { createClient } from "@/lib/supabase/server";
import { cargarAviso } from "@/lib/dashboard/datos";

/**
 * Avisos y novedades: una sola imagen, la que el admin sube como banner
 * (platform_settings.dashboard_banner_url). Si no hay, el bloque no se
 * pinta y Estado de cuenta ocupa la fila entera: eso lo decide la pagina
 * mirando el mismo dato.
 */
export async function Aviso() {
  const supabase = await createClient();
  const aviso = await cargarAviso(supabase);
  if (!aviso) return null;

  return (
    <section
      aria-label="Avisos y novedades"
      className="flex min-h-[238px] flex-col overflow-hidden rounded-[13px] border border-dash-border bg-dash-card"
    >
      <header className="flex items-center justify-between border-b border-dash-border-soft px-4 py-[13px]">
        <div className="flex items-center gap-2 font-dash-ui text-[13.5px] font-semibold text-dash-text">
          <span aria-hidden>📢</span>
          Avisos y novedades
        </div>
        <span className="rounded-[20px] bg-dash-green-13 px-2 py-0.5 font-dash-ui text-[10.5px] font-semibold text-dash-green-text">
          Nuevo
        </span>
      </header>
      <div className="relative min-h-0 flex-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL externa administrada desde admin */}
        <img
          src={aviso.imagenUrl}
          alt="Aviso del equipo ByBluee"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </section>
  );
}
