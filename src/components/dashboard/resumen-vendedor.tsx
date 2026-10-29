import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceId } from "@/lib/workspace";
import { cargarVentas } from "@/lib/vendedores/datos";
import { resumirVentas } from "@/lib/vendedores/comision";

const pesos = (cents: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(cents / 100);
const cuando = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

/**
 * Dashboard del vendedor (0160): solo lo suyo. Los chats y contactos salen con
 * su sesion (la base solo le deja ver los asignados a el); las ventas, del servidor.
 */
export async function ResumenVendedor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const workspaceId = await getWorkspaceId(supabase);
  if (!user || !workspaceId) return null;

  const ahora = new Date();
  const en7 = new Date(ahora.getTime() + 7 * 86_400_000).toISOString();
  const [{ data: sinLeer }, { count: chats }, { count: contactos }, { data: recordatorios }, { data: citas }, ventas] = await Promise.all([
    supabase.rpc("chats_sin_leer_total", { p_workspace: workspaceId, p_user: user.id }),
    supabase.from("conversations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("assigned_agent_id", user.id),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase
      .from("recordatorios")
      .select("id, texto, recordar_en, conversation_id, contacts(name, wa_id)")
      .eq("workspace_id", workspaceId)
      .is("avisado_en", null)
      .gte("recordar_en", ahora.toISOString())
      .lte("recordar_en", en7)
      .order("recordar_en")
      .limit(5),
    supabase
      .from("agenda_eventos")
      .select("id, titulo, inicio, conversation_id")
      .eq("workspace_id", workspaceId)
      .eq("estado", "confirmado")
      .gte("inicio", ahora.toISOString())
      .lte("inicio", en7)
      .order("inicio")
      .limit(5),
    cargarVentas(createAdminClient(), { soloDe: user.id }),
  ]);

  const r = resumirVentas(
    ventas.map((v) => ({ estado: v.estado, monto_cents: v.montoCents, comision_cents: v.comisionCents, created_at: v.creadaEl })),
    ahora
  );

  const proximos = [
    ...(recordatorios ?? []).map((x) => {
      const c = x.contacts as unknown as { name: string | null; wa_id: string } | null;
      return {
        id: `r-${x.id}`,
        cuando: x.recordar_en as string,
        texto: `⏰ ${c?.name?.trim() || c?.wa_id || "Contacto"}: ${x.texto}`,
        href: `/dashboard/inbox/${x.conversation_id}`,
      };
    }),
    ...(citas ?? []).map((x) => ({
      id: `c-${x.id}`,
      cuando: x.inicio as string,
      texto: `📅 ${x.titulo}`,
      href: x.conversation_id ? `/dashboard/inbox/${x.conversation_id}` : "/dashboard/agenda",
    })),
  ]
    .sort((a, b) => a.cuando.localeCompare(b.cuando))
    .slice(0, 6);

  const tarjetas = [
    { t: "Chats sin leer", v: String(Number(sinLeer ?? 0)), c: Number(sinLeer ?? 0) > 0 ? "text-dash-green-text" : "text-dash-text", href: "/dashboard/inbox" },
    { t: "Mis chats", v: String(chats ?? 0), c: "text-dash-text", href: "/dashboard/inbox" },
    { t: "Mis contactos", v: String(contactos ?? 0), c: "text-dash-text", href: "/dashboard/contacts" },
    { t: "Licencias este mes", v: String(r.licenciasMes), c: "text-dash-text", href: "/dashboard/inbox/mis-ventas" },
    { t: "Comisión por cobrar", v: pesos(r.porCobrarCents), c: "text-dash-green-text", href: "/dashboard/inbox/mis-ventas" },
    { t: "En revisión", v: pesos(r.pendienteCents), c: "text-dash-amber", href: "/dashboard/inbox/mis-ventas" },
  ];

  const tarjeta = "rounded-[15px] border border-dash-border bg-dash-card p-5";

  return (
    <>
      <section aria-label="Tu resumen" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tarjetas.map((k) => (
          <Link key={k.t} href={k.href} className={`${tarjeta} transition-colors duration-150 hover:bg-dash-surface-subtle`}>
            <p className="font-dash-ui text-[12px] text-dash-text-2">{k.t}</p>
            <p className={`mt-1 font-dash-display text-[20px] font-bold tracking-[-.3px] ${k.c}`}>{k.v}</p>
          </Link>
        ))}
      </section>

      <section aria-label="Tu agenda" className={tarjeta}>
        <header className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-dash-display text-[16px] font-bold tracking-[-.2px] text-dash-text">Tu agenda · próximos 7 días</h2>
          <Link href="/dashboard/agenda" className="font-dash-ui text-[12px] font-semibold text-dash-green-text hover:underline">
            Ver agenda
          </Link>
        </header>
        {proximos.length === 0 ? (
          <p className="font-dash-ui text-[13px] text-dash-text-3">No tienes recordatorios ni citas en los próximos 7 días.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-dash-border">
            {proximos.map((p) => (
              <li key={p.id}>
                <Link href={p.href} className="flex items-baseline gap-3 py-2 font-dash-ui text-[13px] hover:text-dash-green-text">
                  <span className="w-[150px] shrink-0 capitalize text-dash-text-2">{cuando(p.cuando)}</span>
                  <span className="min-w-0 truncate text-dash-text">{p.texto}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
