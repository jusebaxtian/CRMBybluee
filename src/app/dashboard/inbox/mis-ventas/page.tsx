import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { vendedorActivo } from "@/lib/vendedores/ventas";
import { cargarVentas } from "@/lib/vendedores/datos";
import { ETIQUETA_ESTADO, resumirVentas } from "@/lib/vendedores/comision";

export const dynamic = "force-dynamic";

const pesos = (cents: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(cents / 100);
const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" }) : "—";

const ESTILO_ESTADO: Record<string, string> = {
  pendiente: "bg-warning/15 text-warning",
  aprobada: "bg-primary/15 text-primary",
  pagada: "bg-success/15 text-success",
  anulada: "bg-border text-muted",
};

/** Panel del vendedor: lo que ha vendido, su comision y sus clientes. Solo ve lo suyo. */
export default async function MisVentasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const admin = createAdminClient();
  const vendedor = await vendedorActivo(admin, user.id);
  if (!vendedor) redirect("/dashboard/inbox");

  const ventas = await cargarVentas(admin, { soloDe: user.id });
  const r = resumirVentas(
    ventas.map((v) => ({ estado: v.estado, monto_cents: v.montoCents, comision_cents: v.comisionCents, created_at: v.creadaEl })),
    new Date()
  );

  const tarjetas = [
    { t: "Licencias este mes", v: String(r.licenciasMes), c: "text-foreground" },
    { t: "Licencias en total", v: String(r.licenciasTotal), c: "text-foreground" },
    { t: "Total vendido", v: pesos(r.vendidoCents), c: "text-foreground" },
    { t: "Comisión ganada", v: pesos(r.ganadaCents), c: "text-success" },
    { t: "Por cobrar", v: pesos(r.porCobrarCents), c: "text-primary" },
    { t: "En revisión", v: pesos(r.pendienteCents), c: "text-warning" },
  ];

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto p-4 sm:p-6">
      <Link href="/dashboard/inbox" className="mb-3 flex items-center gap-1 text-xs text-muted hover:text-foreground lg:hidden">
        <ArrowLeft size={14} /> Volver a los chats
      </Link>
      <h1 className="text-xl font-semibold text-foreground">Mis ventas</h1>
      <p className="mt-1 text-sm text-muted">
        Tu comisión es del {Number(vendedor.comision_pct)}% de la primera venta de cada cliente. Queda «en revisión» hasta que el
        administrador confirma el pago.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tarjetas.map((k) => (
          <div key={k.t} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-muted">{k.t}</p>
            <p className={`mt-1 text-lg font-semibold ${k.c}`}>{k.v}</p>
          </div>
        ))}
      </div>

      <p className="mb-2 mt-6 text-sm font-medium text-foreground">Mis clientes</p>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Licencia</th>
              <th className="px-4 py-3 font-medium">Pagó</th>
              <th className="px-4 py-3 font-medium">Tu comisión</th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.id} className="border-b border-border align-top last:border-b-0">
                <td className="px-4 py-3">
                  {v.conversationId ? (
                    <Link href={`/dashboard/inbox/${v.conversationId}`} className="font-medium text-foreground hover:underline">
                      {v.cliente}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">{v.cliente}</span>
                  )}
                  <p className="text-xs text-muted">Vendida el {fecha(v.creadaEl)}</p>
                </td>
                <td className="px-4 py-3 text-foreground">{v.plan}</td>
                <td className="px-4 py-3 text-xs text-muted">
                  {v.espacio
                    ? v.espacio.estado === "active"
                      ? `Activa hasta ${fecha(v.espacio.vence)}`
                      : v.espacio.estado === "past_due"
                        ? "Vencida"
                        : v.espacio.estado
                    : v.sinRegistrar
                      ? "Falta que se registre con el enlace"
                      : "—"}
                </td>
                <td className="px-4 py-3 text-foreground">{pesos(v.montoCents)}</td>
                <td className="px-4 py-3">
                  <p className="text-foreground">{pesos(v.comisionCents)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTILO_ESTADO[v.estado]}`}>{ETIQUETA_ESTADO[v.estado]}</span>
                </td>
              </tr>
            ))}
            {ventas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Aún no tienes ventas. Cuando un cliente de tus chats te envíe el comprobante, toca «Registrar pago» en ese mensaje.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
