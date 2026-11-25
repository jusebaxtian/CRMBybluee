import { createClient } from "@/lib/supabase/server";
import { FilaCompra, type CompraAdmin } from "@/components/admin/curso-form";

/**
 * Compras de cursos por revisar y aprobar. Vive en Admin -> Pagos desde el 25
 * nov 2026 (antes estaba en Capacitaciones, donde no se encontraba): es plata
 * que entra, como las transferencias de planes.
 */
export async function ComprasDeCursos() {
  const supabase = await createClient();
  const { data: compras } = await supabase
    .from("curso_compras")
    .select("id, metodo, monto_cents, status, proof_path, created_at, cursos(titulo), workspaces(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  const filas: CompraAdmin[] = (compras ?? []).map((c) => {
    const curso = c.cursos as unknown as { titulo: string } | null;
    const ws = c.workspaces as unknown as { name: string } | null;
    return {
      id: c.id,
      curso: curso?.titulo ?? "—",
      espacio: ws?.name ?? "—",
      metodo: c.metodo,
      monto_cents: c.monto_cents,
      status: c.status,
      tiene_comprobante: !!c.proof_path,
      created_at: c.created_at,
    };
  });
  const pendientes = filas.filter((c) => c.status === "pending").length;

  return (
    <div id="compras-de-cursos" className="overflow-hidden rounded-xl border border-border bg-surface">
      <p className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">
        Compras de cursos
        {pendientes > 0 && <span className="ml-2 rounded-full bg-warning/20 px-2 py-0.5 text-[11px] text-warning">{pendientes} por revisar</span>}
      </p>
      {filas.length === 0 && <p className="px-5 py-6 text-sm text-muted">Todavía no hay compras.</p>}
      {filas.map((c) => (
        <FilaCompra key={c.id} c={c} />
      ))}
    </div>
  );
}
