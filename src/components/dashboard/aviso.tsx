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
      {/* Escritorio: la imagen llena la tarjeta (recorte por los bordes).
          Movil y tablet (<=900px, donde la fila pasa a una columna): la
          imagen se ve completa, a su proporcion, para que el texto se lea. */}
      <div className="relative min-[901px]:min-h-0 min-[901px]:flex-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL externa administrada desde admin */}
        <img
          src={aviso.imagenUrl}
          alt="Aviso del equipo ByBluee"
          className="block h-auto w-full min-[901px]:absolute min-[901px]:inset-0 min-[901px]:h-full min-[901px]:object-cover"
        />
      </div>
    </section>
  );
}
