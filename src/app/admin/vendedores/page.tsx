import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/admin";
import { cargarVentas } from "@/lib/vendedores/datos";
import { ETIQUETA_ESTADO, resumirVentas } from "@/lib/vendedores/comision";
import { AccionesVenta, ConvertirAsesor, EditarVendedor, FormNuevoVendedor } from "@/components/admin/vendedores";

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

export default async function VendedoresPage() {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const [{ data: vendedores }, ventas, { data: espacio }] = await Promise.all([
    admin.from("vendedores").select("user_id, workspace_id, comision_pct, activo, created_at").order("created_at"),
    cargarVentas(admin),
    admin.from("workspace_members").select("workspace_id").eq("user_id", user?.id ?? "").eq("role", "owner").limit(1).maybeSingle(),
  ]);

  // Firmar los comprobantes (bucket privado) para verlos antes de aprobar.
  const firmados = new Map<string, string>();
  await Promise.all(
    ventas
      .filter((v) => v.comprobantePath && v.estado === "pendiente")
      .map(async (v) => {
        const { data } = await admin.storage.from("payment-proofs").createSignedUrl(v.comprobantePath as string, 60 * 10);
        if (data?.signedUrl) firmados.set(v.id, data.signedUrl);
      })
  );

  // Asesores de tu espacio que todavia no son vendedores.
  const ids = new Set((vendedores ?? []).map((v) => v.user_id as string));
  const { data: miembros } = espacio
    ? await admin.from("workspace_members").select("user_id").eq("workspace_id", espacio.workspace_id).eq("role", "agent")
    : { data: [] };
  const asesores: { id: string; nombre: string }[] = [];
  for (const m of (miembros ?? []).filter((x) => !ids.has(x.user_id as string))) {
    const { data: u } = await admin.auth.admin.getUserById(m.user_id as string);
    const meta = u.user?.user_metadata as { full_name?: string } | undefined;
    asesores.push({ id: m.user_id as string, nombre: meta?.full_name?.trim() || u.user?.email || "Asesor" });
  }

  const filasVendedores = await Promise.all(
    (vendedores ?? []).map(async (v) => {
      const { data: u } = await admin.auth.admin.getUserById(v.user_id as string);
      const meta = u.user?.user_metadata as { full_name?: string } | undefined;
      const suyas = ventas.filter((x) => x.vendedorId === v.user_id);
      return {
        id: v.user_id as string,
        nombre: meta?.full_name?.trim() || u.user?.email || "Vendedor",
        correo: u.user?.email ?? "",
        pct: Number(v.comision_pct),
        activo: !!v.activo,
        resumen: resumirVentas(
          suyas.map((x) => ({ estado: x.estado, monto_cents: x.montoCents, comision_cents: x.comisionCents, created_at: x.creadaEl })),
          new Date()
        ),
      };
    })
  );

  const total = resumirVentas(
    ventas.map((x) => ({ estado: x.estado, monto_cents: x.montoCents, comision_cents: x.comisionCents, created_at: x.creadaEl })),
    new Date()
  );
  const porAprobar = ventas.filter((v) => v.estado === "pendiente").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Vendedores</h1>
        <p className="mt-1 text-sm text-muted">
          Asesores de tu espacio que venden el CRM. Atienden solo los chats que les asignas y registran la venta con el comprobante.
          Ganan comisión solo por la primera venta de cada cliente, y tú la apruebas cuando confirmas que el dinero entró.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { t: "Por aprobar", v: `${porAprobar} · ${pesos(total.pendienteCents)}`, c: "text-warning" },
          { t: "Por pagar a vendedores", v: pesos(total.porCobrarCents), c: "text-primary" },
          { t: "Comisiones pagadas", v: pesos(total.pagadaCents), c: "text-success" },
          { t: "Vendido por vendedores", v: pesos(total.vendidoCents), c: "text-foreground" },
        ].map((k) => (
          <div key={k.t} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-muted">{k.t}</p>
            <p className={`mt-1 text-lg font-semibold ${k.c}`}>{k.v}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="mb-3 text-sm font-medium text-foreground">Nuevo vendedor</p>
        <FormNuevoVendedor />
        {asesores.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-xs text-muted">O convierte en vendedor a un asesor que ya tienes:</p>
            <ConvertirAsesor asesores={asesores} />
          </div>
        )}
      </section>

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-4 py-3 font-medium">Vendedor</th>
              <th className="px-4 py-3 font-medium">Comisión</th>
              <th className="px-4 py-3 font-medium">Licencias</th>
              <th className="px-4 py-3 font-medium">Vendido</th>
              <th className="px-4 py-3 font-medium">Por aprobar</th>
              <th className="px-4 py-3 font-medium">Por pagar</th>
              <th className="px-4 py-3 font-medium">Pagado</th>
            </tr>
          </thead>
          <tbody>
            {filasVendedores.map((v) => (
              <tr key={v.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{v.nombre}</p>
                  <p className="text-xs text-muted">{v.correo}</p>
                </td>
                <td className="px-4 py-3">
                  <EditarVendedor userId={v.id} pct={v.pct} activo={v.activo} />
                </td>
                <td className="px-4 py-3 text-foreground">
                  {v.resumen.licenciasTotal} <span className="text-xs text-muted">({v.resumen.licenciasMes} este mes)</span>
                </td>
                <td className="px-4 py-3 text-foreground">{pesos(v.resumen.vendidoCents)}</td>
                <td className="px-4 py-3 text-warning">{pesos(v.resumen.pendienteCents)}</td>
                <td className="px-4 py-3 font-semibold text-primary">{pesos(v.resumen.porCobrarCents)}</td>
                <td className="px-4 py-3 text-success">{pesos(v.resumen.pagadaCents)}</td>
              </tr>
            ))}
            {filasVendedores.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  Todavía no tienes vendedores.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        <p className="px-4 pt-4 text-sm font-medium text-foreground">Ventas</p>
        <table className="mt-2 w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Vendedor</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Pagó</th>
              <th className="px-4 py-3 font-medium">Comisión</th>
              <th className="px-4 py-3 font-medium">Licencia</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.id} className="border-b border-border align-top last:border-b-0">
                <td className="px-4 py-3 text-muted">{fecha(v.creadaEl)}</td>
                <td className="px-4 py-3 text-foreground">{v.vendedorNombre}</td>
                <td className="px-4 py-3">
                  {v.conversationId ? (
                    <Link href={`/dashboard/inbox/${v.conversationId}`} className="font-medium text-foreground hover:underline">
                      {v.cliente}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">{v.cliente}</span>
                  )}
                  {v.telefono && <p className="text-xs text-muted">{v.telefono}</p>}
                  {firmados.get(v.id) && (
                    <a href={firmados.get(v.id)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                      Ver comprobante
                    </a>
                  )}
                </td>
                <td className="px-4 py-3 text-foreground">{v.plan}</td>
                <td className="px-4 py-3 text-foreground">{pesos(v.montoCents)}</td>
                <td className="px-4 py-3 text-foreground">
                  {pesos(v.comisionCents)} <span className="text-xs text-muted">({v.comisionPct}%)</span>
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  {v.espacio ? (
                    <>
                      <span className="text-foreground">{v.espacio.nombre}</span>
                      <br />
                      {v.espacio.estado === "active" ? `Activa hasta ${fecha(v.espacio.vence)}` : v.espacio.estado}
                    </>
                  ) : v.sinRegistrar ? (
                    "Aún no se registra"
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTILO_ESTADO[v.estado]}`}>{ETIQUETA_ESTADO[v.estado]}</span>
                  {v.estado === "pagada" && v.notaPago && <p className="mt-1 text-xs text-muted">{v.notaPago}</p>}
                </td>
                <td className="px-4 py-3">
                  <AccionesVenta ventaId={v.id} estado={v.estado} />
                </td>
              </tr>
            ))}
            {ventas.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-muted">
                  Todavía no hay ventas de vendedores.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
