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
      className="flex flex-col overflow-hidden rounded-[13px] border border-dash-border bg-dash-card min-[901px]:min-h-[238px]"
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
      {/* La imagen se ve SIEMPRE completa, a su proporcion (antes en escritorio
          llenaba la tarjeta con object-cover y recortaba los bordes del banner).
          Si la tarjeta queda mas alta que la imagen, esta va centrada sobre un
          fondo oscuro para que el espacio sobrante no se note. */}
      <div className="flex flex-1 items-center bg-[#06281d]">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL externa administrada desde admin */}
        <img src={aviso.imagenUrl} alt="Aviso del equipo ByBluee" className="block h-auto w-full" />
      </div>
    </section>
  );
}
